-- 035_checkin_email.sql — 15-min checkin email idempotency lock.
--
-- One column on app_users: stamps when we sent the "your bank is
-- taking longer than usual" reassurance email. NULL = never sent;
-- non-null = already sent (don't resend).
--
-- The cron path (/api/cron/send-checkin-emails) reads this to find
-- users who connected > 15 min ago, haven't reached first_ready_at,
-- and haven't been emailed yet.

alter table public.app_users
  add column if not exists checkin_email_sent_at timestamptz;
