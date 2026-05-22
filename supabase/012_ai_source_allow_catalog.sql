-- 012_ai_source_allow_catalog.sql
--
-- Migration 003 created subscriptions.ai_source with a CHECK constraint
-- limited to ('llm','plaid','raw','unknown'). The phase-2 detection
-- engine introduced a new provenance value 'catalog' (rows whose
-- canonical name + category came from merchant-catalog.json without
-- any LLM call), and every upsert from the engine now fails with
-- error code 23514:
--
--   new row for relation "subscriptions" violates check constraint
--   "subscriptions_ai_source_check"
--
-- Fix: drop the old constraint, add a new one that accepts 'catalog'
-- as a first-class value alongside the prior set.
--
-- ai_source semantics (post-migration):
--   catalog  - resolved deterministically via merchant-catalog.json
--   llm      - resolved by Haiku fallback (catalog miss)
--   plaid    - taken from Plaid /transactions/recurring/get enrichment
--   raw      - left in raw descriptor form, no enrichment available
--   unknown  - legacy rows from before provenance tracking

alter table subscriptions
  drop constraint if exists subscriptions_ai_source_check;

alter table subscriptions
  add constraint subscriptions_ai_source_check
  check (ai_source in ('llm','plaid','raw','unknown','catalog'));
