-- 014_feedback_scoring_system.sql
--
-- Probabilistic feedback + scoring system. Three layers:
--   1. Top — deterministic user overrides (user_overrides).
--   2. Middle — calibrated probabilistic score:
--      • per-merchant Beta-Binomial prior (merchants.alpha / .beta)
--      • calibrated logistic over candidate features
--      combined in log-odds space.
--   3. Bottom — offline feedback loop (feedback_events,
--      model_versions) that retrains the logistic layer weekly.
--
-- This migration creates the persistence for layers 1 and 3 plus the
-- prior storage for layer 2. The scoring math lives in lib/scoring.ts;
-- the Beta priors update online from the feedback endpoint.

-- ───────────────────────────────────────────────────────────────────
-- merchants — global, merchant-level prior.
--
-- alpha = positive evidence (this merchant_key really is a subscription)
-- beta  = negative evidence (false positive)
-- posterior_mean = alpha / (alpha + beta)
--
-- The dictionary seed pre-loads known-subscription brands at high
-- alpha so brand-new users get a sensible prior on day one (cold
-- start mitigation). Unknown merchants start near the global base
-- rate (alpha=1, beta=1 → posterior 0.5).
-- ───────────────────────────────────────────────────────────────────

create table if not exists merchants (
  merchant_key       text primary key,
  display_name       text not null,
  category           text,
  alpha              numeric not null default 1.0,
  beta               numeric not null default 1.0,
  is_dictionary_seed boolean not null default false,
  domains            text[] not null default '{}',
  -- Free-form metadata so we can carry dictionary tags (ai=true, etc.)
  -- without ad-hoc columns.
  meta               jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists merchants_dictionary_idx
  on merchants (is_dictionary_seed)
  where is_dictionary_seed = true;

-- ───────────────────────────────────────────────────────────────────
-- user_overrides — top-of-stack deterministic overrides.
--
-- A user labelling a sub forces its classification regardless of
-- score. One row per (user_id, merchant_key); a new label upserts
-- the old one — we treat the most recent feedback as ground truth
-- for that user.
--
-- override_type catalog:
--   confirmed        — user said "yes, this IS a subscription"
--   not_recurring    — user said "this isn't recurring at all"
--   not_subscription — recurring but not a sub (rent, loan)
--   wrong_amount     — sub is real but amount is wrong (override_value
--                      carries { amount_cents })
--   wrong_cadence    — sub is real but cadence is wrong (override_value
--                      carries { frequency })
--   cancelled        — user has cancelled this sub
-- ───────────────────────────────────────────────────────────────────

create table if not exists user_overrides (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  subscription_id uuid references subscriptions(id) on delete set null,
  merchant_key    text not null,
  override_type   text not null check (override_type in (
                    'confirmed',
                    'not_recurring',
                    'not_subscription',
                    'wrong_amount',
                    'wrong_cadence',
                    'cancelled'
                  )),
  override_value  jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One active override per user × merchant. Re-submitting the same
-- combo upserts.
create unique index if not exists user_overrides_user_merchant_uniq
  on user_overrides (user_id, merchant_key);

create index if not exists user_overrides_user_idx
  on user_overrides (user_id);

-- ───────────────────────────────────────────────────────────────────
-- feedback_events — append-only audit log for offline retraining.
--
-- Captures the feature vector at the moment the user labelled the
-- subscription, so the weekly retrainer can fit logistic coefficients
-- against features as the engine saw them at label time (not as they
-- might be re-derived later under a different scanner version).
-- ───────────────────────────────────────────────────────────────────

create table if not exists feedback_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  subscription_id uuid,
  merchant_key    text not null,
  -- Label normalised to a binary outcome for the logistic layer.
  -- positive = "yes this is a subscription"
  -- negative = "no it isn't" (not_recurring OR not_subscription)
  outcome         text not null check (outcome in ('positive', 'negative', 'edit')),
  override_type   text not null,
  features        jsonb not null,
  scanner_version text,
  created_at      timestamptz not null default now()
);

create index if not exists feedback_events_merchant_idx
  on feedback_events (merchant_key, created_at desc);

create index if not exists feedback_events_user_idx
  on feedback_events (user_id, created_at desc);

create index if not exists feedback_events_outcome_idx
  on feedback_events (outcome);

-- ───────────────────────────────────────────────────────────────────
-- model_versions — versioned logistic coefficients.
--
-- The active model row is whatever has is_active=true. The weekly
-- retrainer writes a new candidate row with is_active=false; a
-- separate promote step flips the flag once accuracy is verified.
-- ───────────────────────────────────────────────────────────────────

create table if not exists model_versions (
  id                uuid primary key default gen_random_uuid(),
  version_string    text not null unique,
  coefficients      jsonb not null,
  -- Platt / isotonic calibration parameters for turning raw logistic
  -- output into a true probability.
  calibration       jsonb not null default '{}'::jsonb,
  training_samples  integer not null default 0,
  is_active         boolean not null default false,
  promoted_at       timestamptz,
  created_at        timestamptz not null default now()
);

create unique index if not exists model_versions_active_unique
  on model_versions (is_active)
  where is_active = true;

-- updated_at maintenance for the mutable tables.
create or replace function tg_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists merchants_updated_at on merchants;
create trigger merchants_updated_at
  before update on merchants
  for each row execute function tg_set_updated_at();

drop trigger if exists user_overrides_updated_at on user_overrides;
create trigger user_overrides_updated_at
  before update on user_overrides
  for each row execute function tg_set_updated_at();

-- RLS posture — service role only for engine writes, mirrors the rest
-- of the schema. Client reads will route through API endpoints.
alter table merchants enable row level security;
alter table user_overrides enable row level security;
alter table feedback_events enable row level security;
alter table model_versions enable row level security;
