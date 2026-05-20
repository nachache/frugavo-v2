-- 003_scan_runs.sql
-- Adds the scan_runs audit table and the AI-derived columns on subscriptions
-- that the spec requires. Run after 002_app_schema.sql.

create table if not exists scan_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  source          text not null check (source in ('plaid','webhook','manual','first_connect')),
  detected_count  integer not null default 0,
  failed_items    integer not null default 0,
  duration_ms     integer,
  status          text not null default 'running'
                  check (status in ('running','done','error','timeout'))
);

-- Powers "last scanned X ago" and dashboard audit queries.
create index if not exists scan_runs_user_started_idx
  on scan_runs (user_id, started_at desc);

alter table subscriptions
  add column if not exists normalized_name   text,
  add column if not exists category          text,
  add column if not exists regret_score      numeric(6,3),
  add column if not exists last_ai_run_at    timestamptz,
  add column if not exists ai_source         text
    check (ai_source in ('llm','plaid','raw','unknown'));

-- Lets the reveal stream pull rows already sorted by regret without a
-- secondary in-memory sort.
create index if not exists subscriptions_regret_idx
  on subscriptions (user_id, regret_score desc nulls last);

alter table plaid_items
  add column if not exists needs_refresh boolean not null default false;

-- Per-call AI cost log; rolled up into ai_cost_per_user_30d.
create table if not exists ai_calls (
  id              uuid primary key default gen_random_uuid(),
  user_id         text,
  scan_run_id     uuid references scan_runs(id) on delete set null,
  input_tokens    integer not null,
  output_tokens   integer not null,
  cost_micros     integer not null,
  latency_ms      integer not null,
  cache_hit       boolean not null default false,
  ts              timestamptz not null default now()
);

create index if not exists ai_calls_user_ts_idx
  on ai_calls (user_id, ts desc);
