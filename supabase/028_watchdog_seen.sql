-- 028_watchdog_seen.sql
--
-- "Daily watchdog" overlay timestamp. Updated whenever the user
-- dismisses the watchdog reveal on the dashboard. The next render
-- queries monitoring_alerts (+ recent subscription / override
-- activity) since this timestamp; if nothing notable happened, the
-- overlay stays hidden. This is the surface that says "Frugavo
-- found this while you were sleeping" on return visits.
--
-- Defaults to NULL for existing users. The first dashboard render
-- treats NULL as "show only if there are notable events in the last
-- 7 days" so the very first overlay isn't dominated by months of
-- backfilled activity.

alter table app_users
  add column if not exists watchdog_seen_at timestamptz;

-- Partial index — we only ever read this column to compute a diff
-- against now(), and we only care about non-null values when
-- comparing recency. A regular btree on the column is fine.
create index if not exists app_users_watchdog_seen_idx
  on app_users (watchdog_seen_at);
