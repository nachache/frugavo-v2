-- 024_signup_notified.sql
--
-- Idempotency stamp for the hello@frugavo.com new-signup
-- notification email. Set on first successful send so we never
-- double-notify even if the dashboard is hit before the email
-- transport finishes.

alter table app_users
  add column if not exists signup_notified_at timestamptz;

create index if not exists app_users_signup_notified_idx
  on app_users (signup_notified_at)
  where signup_notified_at is null;
