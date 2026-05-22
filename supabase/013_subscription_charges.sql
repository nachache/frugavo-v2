-- 013_subscription_charges.sql
--
-- Phase 4: canonical billing-history ledger.
--
-- subscriptions  → current aggregate state (latest amount, next charge
--                  estimate, status). One row per detected subscription.
-- subscription_charges → real-money per-transaction history. One row per
--                        actual plaid_transactions row linked to a
--                        subscription. Backed by real money — no
--                        synthetic / forecast / phantom rows.
--
-- All read paths that show "billing history", "last charged", monthly /
-- yearly totals, 12-month chart, price-increase detection, anomaly
-- detection, cancel-detection eventually move to read from this table.
--
-- Determinism contract: same plaid_transactions + same subscriptions +
-- same scanner_version + same as_of_date → byte-identical
-- subscription_charges set. This is enforced by the engine writing on
-- (user_id, subscription_id, plaid_transaction_id) upserts during each
-- scan.

-- Drop any partial/legacy table from a prior failed run. This is a
-- net-new feature at Phase 4 — there is no production data in this
-- table to preserve. If a future migration alters this table after
-- launch, that migration should ALTER, not drop+recreate.
drop table if exists subscription_charges cascade;

create table subscription_charges (
  id                    uuid primary key default gen_random_uuid(),

  -- Scoping. user_id is denormalized off subscriptions for RLS speed
  -- and so we can range-scan a user's entire charge history without
  -- joining subscriptions.
  user_id               text not null,

  -- Parent subscription. Cascade delete because charges have no meaning
  -- without a subscription.
  subscription_id       uuid not null references subscriptions(id) on delete cascade,

  -- Real transaction we resolved this charge to. plaid_transactions
  -- enforces uniqueness on (user_id, plaid_transaction_id); we mirror
  -- the link here. NOT a FK to plaid_transactions because if Plaid
  -- removes a transaction from the cursor stream we don't want the
  -- charge row to disappear (it's history — preserve it).
  plaid_transaction_id  text not null,

  -- Snapshot of the charge facts. Duplicated from plaid_transactions
  -- on purpose: history rows must remain stable even if the underlying
  -- plaid_transactions row is later normalized differently by a future
  -- scanner version.
  posted_date           date not null,
  amount_cents          integer not null,
  currency              text not null default 'USD',
  raw_descriptor        text,
  merchant_key          text,

  -- Detector classification at the time this charge was written.
  --   accepted - inside the recurrence model (drove cadence + amount)
  --   outlier  - linked to the subscription but excluded from cadence
  --              (taxes, FX drift, annual true-ups, family plan changes,
  --              proration, one-off price hikes). Still real money.
  --   ignored  - user manually unlinked / dismissed. Reserved for
  --              future UI; engine never writes 'ignored'.
  detector_status       text not null
    check (detector_status in ('accepted','outlier','ignored')),

  -- HOW we linked this charge to this subscription. Useful for
  -- debugging recall regressions and for surfacing "this looks unusual
  -- because <reason>" in the UI later.
  --   merchant_key  - matched directly on plaid_transactions.merchant_key
  --   biller_tier   - matched on biller_passthrough amount-bucketed key
  --   manual        - user-confirmed link (future UI)
  matched_by            text not null
    check (matched_by in ('merchant_key','biller_tier','manual')),

  -- Detector confidence at link time. Mirrors subscriptions.confidence
  -- but frozen at the moment this charge was matched, so historical
  -- replay sees the same value even if the parent subscription's
  -- aggregate confidence drifts later.
  confidence            numeric(6,3),

  -- Which cycle of the cadence this charge belongs to. Cycle 1 is the
  -- earliest accepted charge, cycle 2 is the next, etc. Outliers get
  -- NULL because they aren't part of the cadence model.
  -- Drives "you're on cycle 14 of 14 since signing up" UX.
  cadence_cycle_id      integer,

  -- Replay metadata. The scan that wrote this row. Lets us reconstruct
  -- which engine version produced which links.
  scan_run_id           uuid references scan_runs(id) on delete set null,
  scanner_version       text not null,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Idempotency: a given plaid transaction can only be linked to one
-- subscription per user. Re-scans upsert on this key.
create unique index if not exists subscription_charges_unique_link
  on subscription_charges (user_id, subscription_id, plaid_transaction_id);

-- Chart query: "latest 12 months for subscription X". This is the
-- single hottest read path post-Phase-4. Posted_date DESC so a LIMIT
-- 365 returns the most recent year cheaply.
create index if not exists subscription_charges_sub_date_idx
  on subscription_charges (subscription_id, posted_date desc);

-- User-level rollups: "all charges this month across every sub".
-- Needed for monthly/yearly totals and trend analysis.
create index if not exists subscription_charges_user_date_idx
  on subscription_charges (user_id, posted_date desc);

-- Status filtering: "accepted only" for cadence math, "outlier" for
-- the unusual-charge highlight UI.
create index if not exists subscription_charges_status_idx
  on subscription_charges (subscription_id, detector_status);

-- Replay: "show me everything scan X wrote". Used by the validation
-- harness to compare two scanner versions on the same data.
create index if not exists subscription_charges_scan_idx
  on subscription_charges (scan_run_id);

-- updated_at maintenance.
create or replace function tg_subscription_charges_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists subscription_charges_updated_at on subscription_charges;
create trigger subscription_charges_updated_at
  before update on subscription_charges
  for each row execute function tg_subscription_charges_updated_at();

-- RLS. user_id is text (Clerk user_id), not uuid. We rely on the
-- service role for engine writes and a future Postgres function +
-- Clerk JWT for client reads. For now enable RLS but leave it
-- service-role-only — same posture as subscriptions.
alter table subscription_charges enable row level security;
