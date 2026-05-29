-- 038_feedback_finding_resolve.sql
--
-- Finding-level resolution feedback. The "Frugavo noticed" surface
-- shows finding cards (composed from money_leaks + shock_insights +
-- concentration + doubt items). Each finding has a stable id and is
-- shown until the user either:
--
--   • Taps "Look into it" → action = 'look_into_it'
--   • Taps "Looks fine"   → action = 'looks_fine'
--
-- Both actions mark the finding as resolved so it stops appearing
-- in the feed (/app/noticed) and as the featured card on /app.
--
-- This is DISTINCT from user_overrides, which captures per-
-- subscription decisions. The same physical resolution writes BOTH
-- a per-subscription override (for engine learning) AND a row here
-- (for finding-level feed state). The two systems are intentionally
-- decoupled — a finding can reference 0..N subscriptions, and the
-- finding's resolution state shouldn't get lost if the user later
-- changes their per-subscription decision.
--
-- Idempotency: one resolution per (user, finding_id). A user
-- changing their mind would need a "reopen" flow (not built yet).

CREATE TABLE IF NOT EXISTS feedback_finding_resolve (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   text NOT NULL,
  -- The Finding.id from lib/selectors/findings.ts. Shape examples:
  --   'leak:<money_leak_id>'
  --   'shock:<shock_insight_id>'
  --   'concentration:dashboard'
  finding_id      text NOT NULL,
  -- The Finding.kind from lib/selectors/findings.ts. Stored for
  -- analytics convenience — lets us answer "how often do users
  -- resolve duplicates as 'looks fine' vs 'look into it'?" without
  -- re-joining to the source signal.
  finding_kind    text NOT NULL,
  action          text NOT NULL CHECK (
    action IN ('look_into_it', 'looks_fine')
  ),
  -- Snapshot of the subscription ids the finding referenced at the
  -- moment of resolution. Frozen at write time so this row stays
  -- meaningful even if the underlying subscriptions are later
  -- deleted or re-classified.
  subscription_ids text[] DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- One resolution per (user, finding). UNIQUE doubles as the
  -- read-side filter — the dashboard selector reads this set and
  -- filters resolved findings from the feed.
  UNIQUE (clerk_user_id, finding_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_finding_resolve_user
  ON feedback_finding_resolve (clerk_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_finding_resolve_kind_action
  ON feedback_finding_resolve (finding_kind, action);

COMMENT ON TABLE feedback_finding_resolve IS
  'Finding-level resolution from /app/noticed. Distinct from user_overrides (per-subscription). One row per (user, finding_id).';
