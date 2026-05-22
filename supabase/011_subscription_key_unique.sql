-- 011_subscription_key_unique.sql
--
-- Replace migration 010's PARTIAL unique index on
-- subscriptions(user_id, subscription_key) with a regular UNIQUE
-- CONSTRAINT. Postgres does not accept partial indexes as the target
-- of an INSERT ... ON CONFLICT clause, which broke every upsert in
-- the scan pipeline (error 42P10).
--
-- Fix:
--   1. Backfill any remaining NULL subscription_key rows to a sentinel
--      derived from id, so the NOT NULL we add below succeeds.
--   2. Drop the partial index.
--   3. Set subscription_key NOT NULL.
--   4. Add a proper UNIQUE constraint that ON CONFLICT can target.

-- 1) Belt-and-suspenders backfill. Migration 010 already backfilled
-- most rows; this catches anything inserted between the two migrations.
update subscriptions
   set subscription_key = encode(
         digest(user_id || ':' || id::text, 'sha256'),
         'hex'
       )
 where subscription_key is null;

-- 2) Drop the partial index that ON CONFLICT can't use.
drop index if exists subscriptions_user_subkey_unique_idx;

-- 3) Enforce non-null so the unique constraint covers every row.
alter table subscriptions
  alter column subscription_key set not null;

-- 4) Real unique constraint. This is the ON CONFLICT target the scan
-- engine specifies via { onConflict: "user_id,subscription_key" }.
alter table subscriptions
  drop constraint if exists subscriptions_user_subscription_key_unique;
alter table subscriptions
  add constraint subscriptions_user_subscription_key_unique
  unique (user_id, subscription_key);
