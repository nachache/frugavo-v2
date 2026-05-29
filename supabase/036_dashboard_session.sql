-- 036_dashboard_session.sql
--
-- Adds a "meaningful first dashboard session" signal to app_users.
--
-- Why this exists:
--   welcomed_at fires on first /app/welcome render OR is auto-stamped
--   on the dashboard self-heal path for paid users — so it can land
--   from a 200ms accidental refresh after Stripe success. That's too
--   weak to use as the release condition for the onboarding urgent-
--   alert grace window (lib/notifications/dispatch.ts).
--
--   dashboard_first_session_at is stricter: set only after the user
--   has either been on /app for ≥12 seconds with the tab visible, OR
--   has actively interacted (click / scroll / keydown). It's the
--   product's "they really sat down with it" signal.
--
-- Used by:
--   • lib/notifications/dispatch.ts — release urgent-alert grace
--     when either this column OR (now - first_ready_at > 24h).
--
-- The column is nullable + write-once (idempotent IS NULL gate in the
-- API route). Existing users with welcomed_at set get NO automatic
-- backfill: their dashboard_first_session_at will be set the next time
-- they open /app and the pinger condition is satisfied. That's fine —
-- the grace check ALSO has the 24h cap, so existing users (whose
-- first_ready_at is many days old) are already past the grace anyway.

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS dashboard_first_session_at TIMESTAMPTZ;

COMMENT ON COLUMN app_users.dashboard_first_session_at IS
  'Set on the user''s first meaningful dashboard session (visible ≥12s OR interaction). Used as the release signal for the onboarding urgent-alert grace window in lib/notifications/dispatch.ts. Stricter than welcomed_at, which can land on an accidental refresh.';
