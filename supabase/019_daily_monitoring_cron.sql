-- Migration 019 — daily monitoring cron infrastructure.
--
-- Two changes:
--
--   1. app_users.timezone — IANA timezone string (e.g. 'America/New_York').
--      Captured from Intl.DateTimeFormat().resolvedOptions().timeZone on
--      first scan. Defaults to America/New_York for legacy users until
--      they next open the app.
--
--   2. cron_runs — idempotency log for the daily monitoring sweep.
--      Each row stamps (cron_name, run_key, user_id) so the same
--      (user, day) cannot be processed twice. run_key is the local
--      date string in user timezone, e.g. '2026-05-23'.
--
-- The unique constraint on (cron_name, run_key, user_id) lets the cron
-- handler upsert with ON CONFLICT DO NOTHING — if a previous worker
-- already claimed the slot the second worker silently no-ops, so
-- accidental double-fires (Netlify retry, manual curl during outage)
-- don't double-scan the same user.

-- ─── 1. app_users.timezone ─────────────────────────────────────────
alter table public.app_users
  add column if not exists timezone text not null default 'America/New_York';

-- Useful for the cron sweep: "which timezones have it just hit 6am?"
create index if not exists app_users_timezone_idx
  on public.app_users(timezone);

-- ─── 2. cron_runs ──────────────────────────────────────────────────
create table if not exists public.cron_runs (
  id            uuid primary key default gen_random_uuid(),
  cron_name     text not null,                 -- e.g. 'daily-monitoring'
  run_key       text not null,                 -- e.g. '2026-05-23' (user-local date)
  user_id       text,                          -- nullable for cron-wide rows
  status        text not null default 'started',  -- started | finished | failed
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  error_msg     text,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- Idempotency: at most one row per (cron_name, run_key, user_id).
-- A null user_id means the row tracks the cron sweep as a whole, not a
-- single user — those rows still uniquely keyed by (cron_name, run_key).
create unique index if not exists cron_runs_unique_per_user
  on public.cron_runs(cron_name, run_key, user_id)
  where user_id is not null;

create unique index if not exists cron_runs_unique_global
  on public.cron_runs(cron_name, run_key)
  where user_id is null;

create index if not exists cron_runs_started_at_idx
  on public.cron_runs(started_at desc);

-- Service role bypasses RLS.
alter table public.cron_runs enable row level security;
