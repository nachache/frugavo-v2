-- Migration 020 — notification infrastructure.
--
-- Two tables:
--
--   1. notification_preferences — per-user opt-ins. One row per user.
--      Defaults set so a brand-new user gets all alert types ON via
--      email (we want them to feel protected from day one). Toggling
--      off requires explicit action either in /app/settings/notifications
--      or via the one-click HMAC unsubscribe link in every email.
--
--      Per-type prefs live in a single jsonb column (enabled_types)
--      so we can add new alert types without a schema migration.
--      Keys mirror monitoring_alerts.alert_type values:
--        new_subscription, price_increase, renewal_upcoming,
--        dormant_resumed, high_charge_amount, trial_converting,
--        missing_renewal, duplicate_subscription
--
--      quiet_hours_local — optional pair "HH:MM-HH:MM" in user's
--      stored timezone. During quiet hours we hold non-urgent emails
--      until the window closes. Urgent emails ignore quiet hours.
--
--      global_unsubscribed_at — set when the user clicks "unsubscribe
--      from all" in an email footer. Disables every notification
--      across every channel. Settable from the prefs page too.
--
--   2. email_dispatches — append-only log of every notification email
--      we've sent. Two purposes: (a) dedup so the same alert never
--      generates two emails (idempotent retries from the cron handler)
--      and (b) deliverability audit ("did we actually email about
--      this Spotify price increase?"). Unique constraint on
--      (alert_id, channel) enforces the dedup.

-- ─── 1. notification_preferences ──────────────────────────────────
create table if not exists public.notification_preferences (
  user_id                   text primary key references public.app_users(id) on delete cascade,
  email_enabled             boolean not null default true,
  digest_enabled            boolean not null default true,   -- non-urgent alerts roll into the digest
  urgent_immediate_enabled  boolean not null default true,   -- urgent types bypass the digest
  enabled_types             jsonb not null default '{
    "new_subscription": true,
    "price_increase": true,
    "renewal_upcoming": true,
    "dormant_resumed": true,
    "high_charge_amount": true,
    "trial_converting": true,
    "missing_renewal": true,
    "duplicate_subscription": true
  }'::jsonb,
  quiet_hours_local         text,                            -- e.g. "22:00-07:00", optional
  global_unsubscribed_at    timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists notif_prefs_global_unsub_idx
  on public.notification_preferences(global_unsubscribed_at)
  where global_unsubscribed_at is null;

alter table public.notification_preferences enable row level security;

-- ─── 2. email_dispatches ──────────────────────────────────────────
create table if not exists public.email_dispatches (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  alert_id      uuid,                                        -- nullable for digest emails (multi-alert)
  digest_key    text,                                        -- e.g. 'digest:USER:2026-05-23' for digest dedup
  channel       text not null default 'email',               -- email | push | sms (future)
  send_kind     text not null,                               -- urgent | digest
  to_email      text not null,
  subject       text not null,
  provider_id   text,                                        -- Resend message id
  status        text not null default 'sent',                -- sent | failed
  error_msg     text,
  created_at    timestamptz not null default now()
);

-- Dedup constraints:
--   - one urgent email per (alert_id, channel)
--   - one digest email per (digest_key, channel)
create unique index if not exists email_dispatches_alert_unique
  on public.email_dispatches(alert_id, channel)
  where alert_id is not null;

create unique index if not exists email_dispatches_digest_unique
  on public.email_dispatches(digest_key, channel)
  where digest_key is not null;

create index if not exists email_dispatches_user_recent_idx
  on public.email_dispatches(user_id, created_at desc);

alter table public.email_dispatches enable row level security;
