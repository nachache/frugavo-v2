-- 010_phase1_2_3_owned_detection.sql
--
-- Single migration covering the structural changes required for the
-- three-phase cutover from Plaid-owned recurrence detection to
-- Frugavo-owned detection over stored transactions.
--
-- Phase 1 — /transactions/sync ingestion (no new tables; plaid_items.cursor
-- and plaid_transactions already exist from migrations 002 and 009).
--
-- Phase 2 — In-house deterministic detection. Each scan records the
-- engine version that produced it so two scans with the same input
-- AND the same engine version are reproducible.
--
-- Phase 3 — Stable subscription identity. The new subscription_key is a
-- deterministic hash of (user_id, normalized_merchant_key) that survives
-- Plaid changing plaid_stream_id mid-stream. User decisions (keep/cancel)
-- carry forward across scans on this key.
--
-- Backward compatibility: every column is added with `if not exists`.
-- Existing rows are backfilled below. The old unique constraint on
-- subscriptions(user_id, plaid_stream_id) is NOT dropped here — a
-- follow-up migration will drop it after the cutover has been live for
-- one release.

-- ---------------------------------------------------------------------
-- Scanner version columns
-- ---------------------------------------------------------------------
alter table scan_runs
  add column if not exists scanner_version text;
alter table scan_snapshots
  add column if not exists scanner_version text;
alter table subscriptions
  add column if not exists scanner_version text;

-- ---------------------------------------------------------------------
-- Richer descriptor + merchant identity on subscriptions
-- ---------------------------------------------------------------------
alter table subscriptions
  add column if not exists raw_descriptor text,
  add column if not exists normalized_descriptor text,
  add column if not exists merchant_key text,
  add column if not exists canonical_name text,
  add column if not exists subscription_key text;

-- Backfill subscription_key for existing rows. SHA-256 over
-- (user_id, lower(normalized_name or merchant_name)). Same merchant on
-- the same user always hashes to the same key.
update subscriptions
   set subscription_key = encode(
         digest(
           user_id || ':' || lower(coalesce(normalized_name, merchant_name, plaid_stream_id, '')),
           'sha256'
         ),
         'hex'
       )
 where subscription_key is null;

-- Backfill the new descriptor fields conservatively. canonical_name
-- mirrors merchant_name for existing rows; future scans will populate
-- raw_descriptor and normalized_descriptor properly.
update subscriptions
   set canonical_name = merchant_name
 where canonical_name is null;
update subscriptions
   set normalized_descriptor = lower(merchant_name)
 where normalized_descriptor is null and merchant_name is not null;
update subscriptions
   set merchant_key = lower(normalized_descriptor)
 where merchant_key is null and normalized_descriptor is not null;

-- Stable-identity unique index. Coexists with the legacy
-- (user_id, plaid_stream_id) unique constraint for the cutover window.
create unique index if not exists subscriptions_user_subkey_unique_idx
  on subscriptions (user_id, subscription_key)
  where subscription_key is not null;

create index if not exists subscriptions_user_merchant_key_idx
  on subscriptions (user_id, merchant_key);

-- ---------------------------------------------------------------------
-- plaid_transactions: enrichment fields populated during sync.
-- The base table already exists from migration 009.
-- ---------------------------------------------------------------------
alter table plaid_transactions
  add column if not exists normalized_descriptor text,
  add column if not exists merchant_key text,
  add column if not exists canonical_name text;

create index if not exists plaid_transactions_user_merchant_key_idx
  on plaid_transactions (user_id, merchant_key, posted_date desc)
  where merchant_key is not null;

-- ---------------------------------------------------------------------
-- Observability: capture how many rows in a scan came from catalog vs
-- LLM, plus shadow-mode diff counts when both detection paths run in
-- parallel. JSONB is the cheapest place for variable-shape metrics.
-- ---------------------------------------------------------------------
alter table scan_runs
  add column if not exists metrics jsonb;
