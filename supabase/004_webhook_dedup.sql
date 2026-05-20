-- 004_webhook_dedup.sql
-- Plaid retries webhooks on any non-2xx within 10s and may double-fire
-- otherwise. The PK on webhook_id makes the second insert raise unique
-- violation (23505), which the handler treats as "already processed".

create table if not exists plaid_webhook_events (
  webhook_id   text primary key,
  item_id      text not null,
  webhook_type text not null,
  webhook_code text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  raw_body     jsonb
);

create index if not exists plaid_webhook_events_item_idx
  on plaid_webhook_events (item_id, received_at desc);
