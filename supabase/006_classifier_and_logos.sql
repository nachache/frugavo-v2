-- 006_classifier_and_logos.sql
--
-- Two structural additions tied to the classifier + logo overhaul:
--
-- 1. subscriptions.classification — separates "is this actually a
--    subscription?" from the existing `status` field (which tracks the
--    lifecycle: active / cancelled / paused). Values:
--      'confirmed'    — classifier passed all gates. Counts toward
--                       totals + candidates + dashboard.
--      'needs_review' — classifier was uncertain (score <= 1, charity
--                       descriptor, or LLM low confidence). Stored but
--                       never surfaced.
--    Default 'needs_review' so any code path that forgets to set it
--    fails safely (no false positives reaching the dashboard).
--
-- 2. subscriptions.classification_signals — JSONB array of every
--    signal/scoring detail produced by the classifier. Auditable per
--    row. e.g. ["freq:MONTHLY","cv:0.012","mature_active",
--    "pfc_positive:ENTERTAINMENT"]
--
-- 3. merchant_logos — cache table for resolved brand logos. Keyed by
--    (domain) OR (merchant_entity_id) so the same brand serves all
--    users from one lookup. `source` records which tier produced it.

alter table subscriptions
  add column if not exists classification text not null default 'needs_review'
    check (classification in ('confirmed','needs_review')),
  add column if not exists classification_signals jsonb,
  add column if not exists classification_score integer;

create index if not exists subscriptions_user_classification_idx
  on subscriptions (user_id, classification);

create table if not exists merchant_logos (
  id                  uuid primary key default gen_random_uuid(),
  domain              text,
  merchant_entity_id  text,
  -- The cached URL we render in the UI. Null + source='monogram' means
  -- we should render the deterministic initials avatar instead.
  logo_url            text,
  source              text not null check (source in ('plaid','logo_api','monogram')),
  fetched_at          timestamptz not null default now(),
  expires_at          timestamptz,
  -- Unique-ish: each domain maps to one row, each merchant_entity_id
  -- maps to one row. Either can be null but at least one must be set.
  constraint merchant_logos_one_key check (domain is not null or merchant_entity_id is not null)
);

create unique index if not exists merchant_logos_domain_idx
  on merchant_logos (domain) where domain is not null;

create unique index if not exists merchant_logos_entity_idx
  on merchant_logos (merchant_entity_id) where merchant_entity_id is not null;
