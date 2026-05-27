-- =========================================================================
-- 033_brand_verdicts.sql — Identity-first detection foundation.
--
-- Backs the Claude-as-verdict architecture documented in
-- docs/intelligence.md (Addendum). Two changes here:
--
--   1. New global `brand_verdicts` table — one row per canonical
--      merchant_key, shared across every user. Same descriptor →
--      same canonical key → same verdict, replayable forever.
--      Written by either the merchant_catalog backfill or by a
--      cache-miss Claude call at scan time.
--
--   2. New `confidence` column on `subscriptions` — first-class
--      0..1 score on every detected candidate. Drives the doubt
--      detection system (Phase B): auto-confirm above 0.85,
--      passive dashboard prompt at 0.55-0.85, active scan chip
--      below 0.55.
--
-- Determinism contract: brand_verdicts rows are stable across
-- replays because the cache key includes (merchant_key,
-- prompt_version, model_version). Bumping either opens a new
-- namespace; existing rows stay valid for replay of historical
-- scans.
-- =========================================================================

-- ──────────────────────────────────────────────────────────────────────
-- Global brand verdicts.
--
-- subscription_likelihood values:
--   always     — pure-subscription brand (Netflix, Spotify, Anthropic).
--                Any occurrence with stable cadence is a subscription.
--   sometimes  — mixed brand (Apple, Amazon, Google, PayPal-passthrough).
--                Per-user resolution depends on cadence + amount + history.
--   never      — one-off retailer (Starbucks, Uber, gas stations).
--                Never surface as a subscription regardless of cadence.
--
-- decided_by values:
--   catalog       — seeded from lib/data/merchant-catalog.json. The
--                   first 134 entries land via the backfill script.
--   claude        — written at scan time by a cache-miss Claude call.
--   manual_admin  — admin override (e.g. correcting a Claude miss).
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.brand_verdicts (
  merchant_key            text primary key,
  display_name            text not null,
  category                text not null,
  subscription_likelihood text not null,
  domain                  text null,
  decided_by              text not null,
  decided_at              timestamptz not null default now(),
  model_version           text null,
  prompt_version          integer null,
  -- Claude-only fields. NULL when decided_by='catalog' or
  -- 'manual_admin'. reasoning is a short string explaining the
  -- verdict (audit + future prompt tuning); confidence_score is
  -- Claude's self-reported certainty 0..1 (lower = more weight on
  -- user resolution downstream).
  reasoning               text null,
  confidence_score        numeric null,
  -- Examples of raw descriptors we've seen that resolved to this
  -- merchant_key. Useful for QA + future prompt tuning. Bounded —
  -- callers should keep the array at ~10 entries via array_remove +
  -- array_append patterns at write time.
  raw_descriptor_samples  text[] not null default '{}',
  -- Audit trail. Updated_at tracks any field change (likelihood
  -- correction, category re-tag); decided_at stays pinned to the
  -- original write.
  updated_at              timestamptz not null default now()
);

-- Constrain likelihood + decided_by to the documented enums. Loose
-- enough that adding a future value (e.g. 'pending_review') only
-- requires dropping and recreating the constraint, not a data
-- migration.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'brand_verdicts_likelihood_chk'
  ) then
    alter table public.brand_verdicts
      add constraint brand_verdicts_likelihood_chk
      check (subscription_likelihood in ('always', 'sometimes', 'never'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'brand_verdicts_decided_by_chk'
  ) then
    alter table public.brand_verdicts
      add constraint brand_verdicts_decided_by_chk
      check (decided_by in ('catalog', 'claude', 'manual_admin'));
  end if;
end$$;

-- Lookup index on category for category-level analytics (e.g. "what
-- fraction of 'sometimes' merchants are streaming?"). Primary key on
-- merchant_key covers the hot read path already.
create index if not exists brand_verdicts_category_idx
  on public.brand_verdicts(category);

-- Filter index for the catalog backfill + admin tools to quickly find
-- rows written by a specific decider.
create index if not exists brand_verdicts_decided_by_idx
  on public.brand_verdicts(decided_by);

-- ──────────────────────────────────────────────────────────────────────
-- subscriptions.confidence — per-candidate confidence score 0..1.
--
-- Written by the doubt detection engine (Phase B). Read by:
--   • ActionCenter — sort + filter
--   • Doubt creation — gates which candidates become Quick Checks
--   • Dashboard surfaces — visual weighting for low-confidence rows
--
-- Default 0.5 for legacy rows. Real values flow on next scan once
-- Phase B lands.
-- ──────────────────────────────────────────────────────────────────────

alter table public.subscriptions
  add column if not exists confidence numeric not null default 0.5;

-- Index supports "find low-confidence active subs that need a doubt
-- prompt" queries. WHERE confidence < 0.85 AND status = 'active' is
-- the hot path.
create index if not exists subscriptions_confidence_active_idx
  on public.subscriptions(user_id, confidence)
  where status = 'active';
