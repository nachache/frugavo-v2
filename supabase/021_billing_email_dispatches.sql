-- 021_billing_email_dispatches.sql
--
-- Idempotent dispatch log for billing emails (trial reminders,
-- payment-failure follow-ups, cancellation goodbyes).
--
-- Why this table is separate from notifications/email_dispatches:
-- billing emails are triggered by stripe events and time-deltas, not
-- by monitoring alerts. They share the Resend transport but have
-- different idempotency semantics — we never want to send the
-- "trial converts tomorrow" email twice for the same subscription,
-- even if the dunning cron sweep runs twice in a day or projection
-- replays an old event.
--
-- Idempotency key: (clerk_user_id, email_type, dedup_key).
-- dedup_key meaning depends on email_type:
--   trial_started       → stripe_subscription_id
--   trial_converts_t6   → stripe_subscription_id + ':t6'
--   payment_declined    → billing_events.event_id (specific failure)
--   payment_retry_t72   → billing_events.event_id of original failure
--   grace_t10           → stripe_subscription_id + ':grace_t10'
--   grace_t18           → stripe_subscription_id + ':grace_t18'
--   protection_paused   → stripe_subscription_id + ':paused'
--   protection_ended    → stripe_subscription_id + ':ended'

create table if not exists billing_email_dispatches (
  id                  uuid primary key default gen_random_uuid(),
  clerk_user_id       text not null,
  email_type          text not null check (email_type in (
    'trial_started',
    'trial_converts_t6',
    'payment_declined',
    'payment_retry_t72',
    'grace_t10',
    'grace_t18',
    'protection_paused',
    'protection_ended'
  )),
  dedup_key           text not null,
  status              text not null default 'sent' check (status in (
    'sent',
    'failed',
    'skipped'
  )),
  resend_message_id   text,
  error               text,
  sent_at             timestamptz not null default now(),
  unique (clerk_user_id, email_type, dedup_key)
);

create index if not exists billing_email_dispatches_user_idx
  on billing_email_dispatches (clerk_user_id, sent_at desc);

create index if not exists billing_email_dispatches_type_idx
  on billing_email_dispatches (email_type, sent_at desc);
