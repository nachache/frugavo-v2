-- 005_subscription_charges.sql
-- Stores per-charge history so the 12-month chart and trend logic read
-- real numbers rather than projecting from current state. In sandbox we
-- seed this from fixtures; in production it gets populated from Plaid's
-- /transactions/sync once we wire that in.

create table if not exists subscription_charges (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  subscription_id uuid references subscriptions(id) on delete cascade,
  plaid_stream_id text,
  amount_cents    integer not null,
  currency        text not null default 'USD',
  charged_at      date not null,
  is_estimated    boolean not null default false,
  inserted_at     timestamptz not null default now(),
  unique (subscription_id, charged_at, amount_cents)
);

create index if not exists subscription_charges_user_date_idx
  on subscription_charges (user_id, charged_at desc);

create index if not exists subscription_charges_sub_date_idx
  on subscription_charges (subscription_id, charged_at desc);
