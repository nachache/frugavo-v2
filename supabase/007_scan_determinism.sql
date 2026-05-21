-- 007_scan_determinism.sql
--
-- Adds the as-of date the scan engine anchors all time-dependent
-- logic against. Stored once at scan start. Every downstream
-- computation (regret_score, "silent sub" window, "started months
-- ago" heuristics) reads this column instead of calling Date.now()
-- at random points. Two scans on the same input + same as_of_date
-- produce identical output.
--
-- Also adds a cached raw input snapshot so a "re-classify" can run
-- the engine over the exact same Plaid response that produced the
-- last scan, without hitting Plaid again. A new "refresh from Plaid"
-- action is the explicit way to advance the snapshot.

alter table scan_runs
  add column if not exists as_of_date timestamptz,
  add column if not exists plaid_input_hash text,
  add column if not exists plaid_input_snapshot jsonb;

create index if not exists scan_runs_user_asof_idx
  on scan_runs (user_id, as_of_date desc);
