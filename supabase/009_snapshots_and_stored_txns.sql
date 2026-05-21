-- 009_snapshots_and_stored_txns.sql
--
-- Two structural additions that take Frugavo from "live re-pull every
-- scan" to "stored transactions + immutable snapshots":
--
-- 1. plaid_transactions — raw transactions as the source of truth.
--    The scan pipeline writes here once per Plaid fetch. Detection
--    (recurrence grouping, classification) then reads from THIS table,
--    not the Plaid response. That's what makes "re-classify without
--    re-fetching" possible — the user can rerun detection against the
--    same stored input and get identical output.
--
-- 2. scan_snapshots — immutable per-scan result blob. Every scan
--    writes exactly one row here at finalize. The dashboard reads from
--    the latest snapshot for a user. Re-scan creates a NEW snapshot;
--    the previous one is untouched. This is what gives us:
--      - integrity: count, list, and monthly upkeep all derive from the
--        same JSON payload, so they cannot disagree.
--      - auditability: every past scan result is preserved.
--      - rollback: if a buggy classifier ships, we can read the prior
--        snapshot without re-scanning.
--
-- The mutable `subscriptions` table is kept for user decisions
-- (keep / cancel). Keyed by plaid_stream_id, which is stable across
-- snapshots, so a "cancelled" decision on one scan carries forward.

create table if not exists plaid_transactions (
  -- Plaid's transaction_id is unique per Item; we add user_id for
  -- multi-tenant locality and so RLS / per-user delete is a single
  -- index hit.
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plaid_item_id uuid not null references plaid_items(id) on delete cascade,
  plaid_transaction_id text not null,
  plaid_stream_id text,
  account_id text not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  iso_currency_code text,
  unofficial_currency_code text,
  merchant_name text,
  name text,
  description text,
  pfc_primary text,
  pfc_detailed text,
  authorized_date date,
  posted_date date not null,
  pending boolean not null default false,
  raw jsonb,
  ingested_at timestamptz not null default now(),
  -- Plaid returns the same transaction_id across syncs; the unique
  -- constraint dedupes safely on conflict.
  unique (user_id, plaid_transaction_id)
);

create index if not exists plaid_transactions_user_posted_idx
  on plaid_transactions (user_id, posted_date desc);

create index if not exists plaid_transactions_stream_idx
  on plaid_transactions (user_id, plaid_stream_id)
  where plaid_stream_id is not null;

-- Immutable per-scan output.
create table if not exists scan_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  scan_run_id uuid not null references scan_runs(id) on delete cascade,
  as_of_date timestamptz not null,
  -- Snapshot payload: array of detected subscription rows. Schema is
  -- defined in lib/types/snapshot.ts so client + server stay in sync.
  payload jsonb not null,
  -- Aggregate fields denormalized for cheap reads. Recompute on insert,
  -- never on read.
  detected_count integer not null,
  monthly_upkeep_cents integer not null,
  created_at timestamptz not null default now(),
  unique (scan_run_id)
);

create index if not exists scan_snapshots_user_created_idx
  on scan_snapshots (user_id, created_at desc);

-- Bank-fees subscriptions need a dedicated category. The category
-- column is text, so no enum change — but we add a comment for clarity.
comment on column subscriptions.category is
  'streaming|software|news|fitness|food_delivery|cloud_storage|telecom|utilities|insurance|gaming|education|bank_fees|other';
