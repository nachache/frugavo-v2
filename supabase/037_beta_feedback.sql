-- 037_beta_feedback.sql
--
-- Beta feedback + product-learning system. Five tables that together
-- form a calm, opinionated learning engine on top of the existing
-- product data.
--
-- Architectural choices documented in /docs/beta-feedback-system.md.
-- Briefly:
--   • Supabase tables only. No third-party analytics widgets.
--   • Event properties are schema-on-read (jsonb). No PII allowed.
--   • Vote chips are one-shot per (user, insight_key). Surprise
--     ratings are one-shot per surface per user. Both enforced via
--     unique constraints below.
--
-- All tables include clerk_user_id (text), created_at, and the
-- usual id pattern. They participate in the existing account-delete
-- cascade — when a user nukes their account, every row keyed on
-- clerk_user_id goes with it.

-- ─── feedback_insights ──────────────────────────────────────────
-- Per-insight 👍/👎 with optional reason on negative votes. Insights
-- are identified by a stable insight_key so we can aggregate across
-- users (e.g. how often "concentration:telecom_45pct" gets a 👎).

CREATE TABLE IF NOT EXISTS feedback_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   text NOT NULL,
  session_id      text,
  -- 'concentration' | 'price_increase' | 'forgotten_sub' | 'badge'
  -- | 'shock' | 'health_score' | etc. Coarse-grained category.
  insight_kind    text NOT NULL,
  -- Stable identifier of the specific insight instance. Examples:
  --   'concentration:telecom_45pct'
  --   'badge:price_increased:netflix'
  --   'shock:ai_stack'
  insight_key     text NOT NULL,
  vote            smallint NOT NULL CHECK (vote IN (-1, 1)),
  -- 'incorrect' | 'not_relevant' | 'already_knew' | 'not_actionable'
  -- | 'other'. NULL when vote = +1.
  reason          text,
  reason_freeform text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- One vote per (user, insight_key). Re-voting is intentionally not
  -- supported — the design treats votes as a moment-in-time signal.
  UNIQUE (clerk_user_id, insight_key)
);

CREATE INDEX IF NOT EXISTS idx_feedback_insights_user_recent
  ON feedback_insights (clerk_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_insights_kind_vote
  ON feedback_insights (insight_kind, vote);

COMMENT ON TABLE feedback_insights IS
  'Per-insight 👍/👎 with reason on negative. One vote per user per insight_key (unique constraint enforces). Reasons are limited to a fixed set.';


-- ─── feedback_accuracy ──────────────────────────────────────────
-- Per-subscription "is this correctly identified?" Four sub-checks
-- because "wrong amount" is a very different signal from "wrong
-- category" — both direct training data for the detection engine.

CREATE TABLE IF NOT EXISTS feedback_accuracy (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id      text NOT NULL,
  subscription_id    uuid NOT NULL,
  merchant_correct   boolean,
  recurrence_correct boolean,
  amount_correct     boolean,
  category_correct   boolean,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  -- One submission per (user, subscription). Future updates would
  -- be new rows under different design; for now we keep the
  -- per-sub feedback as a single canonical statement.
  UNIQUE (clerk_user_id, subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_accuracy_sub
  ON feedback_accuracy (subscription_id);

COMMENT ON TABLE feedback_accuracy IS
  'Per-subscription accuracy feedback. NULL on a check means the user did not flag that field as wrong.';


-- ─── feedback_surprise ──────────────────────────────────────────
-- Three-point "was this surprising?" rating. Fired on welcome reveal
-- end card and on first appearances of major insights. One rating
-- per surface per user.

CREATE TABLE IF NOT EXISTS feedback_surprise (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  -- 'welcome_reveal' | 'concentration' | 'badge_<kind>'
  surface       text NOT NULL,
  -- Stable identifier of the specific instance being rated. May be
  -- NULL when the surface itself is the unit (e.g. welcome_reveal).
  surface_key   text,
  -- 0 = not surprising, 1 = somewhat, 2 = very surprising.
  rating        smallint NOT NULL CHECK (rating IN (0, 1, 2)),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- One rating per (user, surface, surface_key). NULL surface_key
  -- collapses to one rating per surface — the desired behavior.
  UNIQUE (clerk_user_id, surface, surface_key)
);

CREATE INDEX IF NOT EXISTS idx_feedback_surprise_surface_rating
  ON feedback_surprise (surface, rating);

COMMENT ON TABLE feedback_surprise IS
  'Surprise rating. Likely the highest-signal feedback metric in the system. One-shot per (user, surface) by design.';


-- ─── feedback_freeform ──────────────────────────────────────────
-- Catch-all for typed feedback. Prompt column tells us where the
-- response came from: founder modal, end-of-session "what stood
-- out," "would miss," etc. NOT one-shot — same user can write to
-- the founder modal multiple times.

CREATE TABLE IF NOT EXISTS feedback_freeform (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   text NOT NULL,
  -- 'founder_modal' | 'session_standout' | 'would_miss' | etc.
  prompt          text NOT NULL,
  -- For multi-option prompts (e.g. session_standout), the chosen
  -- option. NULL for pure freeform.
  option_picked   text,
  message         text,
  source_url      text,
  -- Optional Supabase Storage path to an uploaded screenshot.
  -- Deferred to Phase 5 per design; column exists now so we don't
  -- need a migration later.
  screenshot_path text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_freeform_prompt_recent
  ON feedback_freeform (prompt, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_freeform_user_recent
  ON feedback_freeform (clerk_user_id, created_at DESC);

COMMENT ON TABLE feedback_freeform IS
  'Catch-all for any free-text feedback. Same shape services founder modal, end-of-session prompt, and the "would miss" deep prompt.';


-- ─── events ─────────────────────────────────────────────────────
-- Behavioral event stream. Single denormalized table. Properties
-- as jsonb so we never need a schema migration to add a new event
-- type. NEVER include PII (merchant names, amounts) in properties.

CREATE TABLE IF NOT EXISTS events (
  id            bigserial PRIMARY KEY,
  clerk_user_id text NOT NULL,
  -- Random per-tab session id generated client-side and persisted
  -- in sessionStorage with a 30-minute sliding TTL. Server-side
  -- emits use the literal 'server'.
  session_id    text NOT NULL,
  -- Event name. Lowercase + underscores. Examples:
  --   'page_view' | 'insight_opened' | 'insight_dismissed'
  --   'subscription_opened' | 'reveal_stage_completed'
  --   'health_score_clicked' | 'share' | 'dashboard_dwell_12s'
  name          text NOT NULL,
  -- All event-specific data. Schema-on-read. NEVER PII.
  properties    jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Path the event fired from, with query string + hash stripped.
  -- NULL for events fired server-side (e.g. first_ready).
  path          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_user_recent
  ON events (clerk_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_name_recent
  ON events (name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_properties_gin
  ON events USING gin (properties);

COMMENT ON TABLE events IS
  'Behavioral event stream. Append-only. 365-day retention by default. Properties is schema-on-read.';
