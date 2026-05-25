-- 030_welcomed_at.sql
--
-- Adds app_users.welcomed_at so the dashboard knows whether the user
-- has seen the cinematic /app/welcome reveal. Without this column,
-- the existing first-scan guard at app/app/page.tsx never fires
-- because by the time the user lands on /app, /app/scanning has
-- already run the scan + populated scan_snapshots, so the guard's
-- "no snapshots AND no sync" condition is impossible to satisfy.
--
-- New gate: NULL = hasn't completed welcome → redirect to /app/welcome.
-- /app/welcome stamps it on the first reveal-stage render so refreshes
-- mid-flow don't bounce the user back to the dashboard.

alter table app_users
  add column if not exists welcomed_at timestamptz;

-- Backfill: any existing account with a scan is treated as already
-- welcomed, so we don't ambush long-time users with a reveal screen
-- the next time they open the app.
update app_users u
   set welcomed_at = now()
  from scan_snapshots s
 where s.user_id = u.id
   and u.welcomed_at is null;
