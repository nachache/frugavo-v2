-- 026_canonical_merchant_key.sql
--
-- Adds the canonical_merchant_key column on plaid_transactions so the
-- identity resolver (lib/merchant-resolve.ts) can collapse descriptor
-- variants to one identity BEFORE the recurrence detector groups
-- transactions.
--
-- WHY: the existing merchant_key fragments single merchants across
-- multiple keys. Apple shows up as APPLE.COM/BILL, APPLE 800-275, and
-- Apple Services. Stage 2 groups by merchant_key, so each fragment
-- has fewer charges than the cadence minimum and the stream never
-- detects. This column lets us substitute a canonical key at the
-- grouping step without rewriting normalizeDescriptor.
--
-- The column is nullable on existing rows. Scan calls the resolver
-- for any descriptor without a canonical_merchant_key, writes it back
-- here so the next scan is a pure cache hit, and groups by
-- COALESCE(canonical_merchant_key, merchant_key) in the detector.

alter table plaid_transactions
  add column if not exists canonical_merchant_key text;

-- Composite index for the detector grouping query
-- (user_id, canonical_merchant_key) -> charges.
create index if not exists plaid_transactions_canonical_idx
  on plaid_transactions (user_id, canonical_merchant_key);

-- Companion column: identity confidence + domain. Used by Stage 2
-- identity-strong survival rule (rejected groups can be re-promoted
-- as low-confidence candidates if they have a merchant_domain set).
alter table plaid_transactions
  add column if not exists canonical_display_name text,
  add column if not exists canonical_domain text,
  add column if not exists canonical_resolved_at timestamptz,
  add column if not exists canonical_resolver_version text;
