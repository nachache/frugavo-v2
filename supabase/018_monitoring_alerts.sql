-- 018_monitoring_alerts.sql
--
-- The alerts table that powers Peace of Mind monitoring.
-- Every detector run produces candidate alerts which upsert into
-- this table keyed by (user_id, dedup_key). The dedup_key is
-- alert-type-specific and captures "this exact event" so re-running
-- detectors doesn't create duplicates.
--
-- Status lifecycle:
--   active        → fresh, surfaces in inbox + dashboard
--   acknowledged  → user has seen it, kept in inbox
--   dismissed     → user dismissed, hidden from default view
--   resolved      → automatic transition when the underlying event
--                   is no longer relevant (e.g. subscription
--                   actually got cancelled after a renewal warning)

create table if not exists monitoring_alerts (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  subscription_id uuid references subscriptions(id) on delete cascade,
  -- merchant_key duplicated for queries that don't need to join.
  merchant_key    text,
  merchant_name   text,
  alert_type      text not null check (alert_type in (
    'new_subscription',
    'price_increase',
    'renewal_upcoming',
    'dormant_resumed',
    'high_charge_amount'
  )),
  severity        text not null default 'info' check (severity in (
    'info',
    'notice',
    'urgent'
  )),
  -- Free-form payload the UI can render. Each alert_type has its
  -- own conventional shape (documented in lib/monitoring/types.ts).
  details         jsonb not null default '{}'::jsonb,
  -- Idempotency key. Format is alert-type-specific:
  --   new_subscription: "new_sub:{plaid_stream_id}"
  --   price_increase:   "price_inc:{plaid_stream_id}:{from}->{to}"
  --   renewal_upcoming: "renewal:{plaid_stream_id}:{next_charge_iso}"
  --   dormant_resumed:  "dormant:{plaid_stream_id}:{resumed_date}"
  --   high_charge:      "high_charge:{plaid_transaction_id}"
  -- Re-running detectors on the same data produces the same keys,
  -- so the unique constraint below makes the orchestrator idempotent.
  dedup_key       text not null,
  status          text not null default 'active' check (status in (
    'active',
    'acknowledged',
    'dismissed',
    'resolved'
  )),
  acknowledged_at timestamptz,
  dismissed_at    timestamptz,
  resolved_at     timestamptz,
  -- Provenance — which scan run produced this alert.
  scan_run_id     uuid references scan_runs(id) on delete set null,
  scanner_version text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists monitoring_alerts_dedup_uniq
  on monitoring_alerts (user_id, dedup_key);

-- Hot path: "show me my active alerts newest-first".
create index if not exists monitoring_alerts_user_active_idx
  on monitoring_alerts (user_id, created_at desc)
  where status = 'active';

-- For the bell badge count + per-type queries.
create index if not exists monitoring_alerts_user_status_idx
  on monitoring_alerts (user_id, status, alert_type);

-- updated_at trigger uses the function created in migration 014.
drop trigger if exists monitoring_alerts_updated_at on monitoring_alerts;
create trigger monitoring_alerts_updated_at
  before update on monitoring_alerts
  for each row execute function tg_set_updated_at();

alter table monitoring_alerts enable row level security;
