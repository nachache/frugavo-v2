-- =========================================================================
-- 032_ingestion_state.sql — durable ingestion state machine
--
-- Production-grade fintech ingestion pattern (Mercury / Brex / Ramp /
-- Copilot). Replaces the ad-hoc "derive readiness from scan_runs at
-- render time" approach with a durable record per plaid_item AND per
-- user that the UI reads from.
--
-- Two surfaces:
--   1. plaid_items columns         — per-item Plaid sync health
--   2. app_users columns           — user-level lifecycle gates
--
-- Both writeable by webhook handlers, scan orchestrator, and any
-- background worker. UI reads only.
-- =========================================================================

-- ──────────────────────────────────────────────────────────────────────
-- Per-item Plaid sync state.
--
-- sync_state values:
--   pending       — item exists, no /transactions/sync call has succeeded yet
--   syncing       — at least one /sync returned rows; still draining
--   awaiting_bank — sync drain finished with zero rows (Classic / queue)
--   ready         — sync drain finished WITH rows
--   needs_reauth  — Plaid returned ITEM_LOGIN_REQUIRED / INVALID_CREDENTIALS
--   error         — non-recoverable Plaid error
-- ──────────────────────────────────────────────────────────────────────

alter table public.plaid_items
  add column if not exists sync_state            text not null default 'pending',
  add column if not exists first_synced_at       timestamptz,
  add column if not exists oldest_txn_date       date,
  add column if not exists newest_txn_date       date,
  add column if not exists txn_count             integer not null default 0,
  add column if not exists last_webhook_at       timestamptz,
  add column if not exists last_webhook_code     text,
  add column if not exists last_error_code       text,
  add column if not exists last_error_at         timestamptz,
  -- Computed 0..1 score. 0 = nothing synced, 1 = full history confirmed
  -- by a successful scan with detected_count > 0. Used as the UI
  -- threshold for "ready to render numbers".
  add column if not exists completeness_score    real not null default 0;

-- Check constraint for sync_state values. Loose enough that a future
-- state can be added without a migration breaking inserts.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plaid_items_sync_state_chk'
  ) then
    alter table public.plaid_items
      add constraint plaid_items_sync_state_chk
      check (sync_state in (
        'pending', 'syncing', 'awaiting_bank', 'ready',
        'needs_reauth', 'error'
      ));
  end if;
end$$;

-- Backfill: existing items with last_synced_at set are at least "syncing"
-- and probably "ready" — leave 'pending' as the default for unsynced
-- items, but bump anyone with a non-null cursor to 'ready'. The next
-- scan will recompute the true state via writeIngestionProgress() so
-- this is just a conservative starting point.
update public.plaid_items
   set sync_state = 'ready'
 where sync_state = 'pending'
   and cursor is not null
   and last_synced_at is not null;

-- ──────────────────────────────────────────────────────────────────────
-- User-level ingestion lifecycle.
--
-- first_ready_at:
--   The moment the user FIRST saw a complete, ready dashboard. Once
--   set, the UI never shows the awaiting screen again — the cached
--   dashboard renders instead with a background-refresh banner. This
--   is the "never empty after first ready" guarantee.
--
-- first_ready_email_sent_at:
--   Idempotency lock for the completion email. We send exactly once,
--   the moment first_ready_at flips from null to not-null. Failures
--   leave first_ready_email_sent_at null so the next finalize retries.
-- ──────────────────────────────────────────────────────────────────────

alter table public.app_users
  add column if not exists first_ready_at            timestamptz,
  add column if not exists first_ready_email_sent_at timestamptz;

-- Helpful indexes for the dashboard readiness query path.
create index if not exists plaid_items_user_sync_state_idx
  on public.plaid_items(user_id, sync_state);
