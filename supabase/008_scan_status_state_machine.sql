-- 008_scan_status_state_machine.sql
--
-- Formalizes the scan lifecycle as a state machine the client can rely on:
--
--   running     — Plaid call in flight, per-stream upserts being written
--   finalizing  — every row is persisted; cache invalidation + downstream
--                 notifications dispatching
--   done        — terminal success; the UI is free to read
--   error       — terminal failure
--   timeout     — terminal: scan exceeded the per-run budget
--
-- The column is already text, so no enum change is needed. This migration
-- adds:
--   1. A CHECK constraint so a stray writer can't store an unknown value.
--   2. An index on (user_id, status, finished_at desc) so "the latest
--      done scan for this user" — which the dashboard hits on every
--      tab-focus check — is a single-row index scan instead of a sort.
--
-- The dashboard polls /api/scan/latest on tab focus to detect that a
-- newer scan finished elsewhere (another tab, the webhook path, the
-- mobile app once it exists) and refreshes the RSC payload via
-- router.refresh(). Without this index that endpoint would degrade as
-- scan_runs grows.

alter table scan_runs
  drop constraint if exists scan_runs_status_check;

alter table scan_runs
  add constraint scan_runs_status_check
  check (status in ('running','finalizing','done','error','timeout'));

create index if not exists scan_runs_user_finished_idx
  on scan_runs (user_id, finished_at desc nulls last)
  where status = 'done';
