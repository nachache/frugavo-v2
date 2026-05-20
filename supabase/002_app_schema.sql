-- Frugavo v1 product schema.
--
-- Run this in the Supabase SQL editor after the waitlist table from
-- 001_waitlist.sql is in place. Idempotent — safe to re-run.
--
-- IDs: user_id columns store the Clerk user ID (text, format
-- "user_2abc..."). We deliberately do NOT use foreign keys to a Supabase
-- auth.users table because authentication is handled by Clerk.
--
-- RLS: enabled with permissive policies for now. The Supabase service-role
-- key bypasses RLS, and the Next.js API routes are the only thing reading
-- and writing this data. We'll tighten RLS once Clerk-Supabase JWT
-- integration is wired up post-MVP.

create extension if not exists pgcrypto;

-- =========================================================================
-- Bank connections per user (one row per Plaid Item).
-- =========================================================================
create table if not exists public.plaid_items (
  id                     uuid primary key default gen_random_uuid(),
  user_id                text not null,
  plaid_item_id          text not null unique,
  plaid_access_token     text not null,          -- encrypt before launch
  institution_name       text,
  institution_id         text,
  status                 text not null default 'active',  -- active | error | disconnected
  last_synced_at         timestamptz,
  cursor                 text,                   -- Plaid transactions sync cursor
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists plaid_items_user_id_idx
  on public.plaid_items(user_id);

-- =========================================================================
-- Detected recurring subscriptions.
-- =========================================================================
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  text not null,
  plaid_item_id            uuid references public.plaid_items(id) on delete cascade,

  -- Plaid's stream ID lets us reconcile on each re-scan instead of
  -- creating duplicates. Null for manually-added subscriptions.
  plaid_stream_id          text,

  merchant_name            text not null,
  merchant_logo_url        text,
  category                 text,                       -- streaming | productivity | fitness | ...
  amount_cents             integer not null,
  currency                 text not null default 'USD',
  frequency                text not null,              -- monthly | annual | weekly | irregular
  last_charged_at          date,
  next_expected_charge_at  date,

  status                   text not null default 'active',  -- active | cancelled | paused | uncertain
  user_decision            text,                       -- keep | cancel | unsure
  user_decision_at         timestamptz,

  cancelled_at             timestamptz,
  cancellation_confirmed_at timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (user_id, plaid_stream_id)                    -- dedupe re-scans
);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx
  on public.subscriptions(status);

-- =========================================================================
-- Audit log of cancellation attempts.
-- =========================================================================
create table if not exists public.cancellations (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id         text not null,
  attempted_at    timestamptz not null default now(),
  method          text not null,                       -- assist | concierge | manual
  outcome         text not null default 'pending',     -- pending | confirmed_via_plaid | failed | uncertain
  outcome_set_at  timestamptz,
  notes           text
);

create index if not exists cancellations_user_id_idx
  on public.cancellations(user_id);
create index if not exists cancellations_subscription_id_idx
  on public.cancellations(subscription_id);

-- =========================================================================
-- App profiles — small mirror of Clerk users for joining/queries.
-- =========================================================================
create table if not exists public.app_users (
  id                  text primary key,            -- Clerk user ID
  email               text not null,
  has_completed_scan  boolean not null default false,
  has_active_subscription boolean not null default false,  -- Frugavo's own $5/mo
  stripe_customer_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists app_users_email_idx
  on public.app_users(email);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.plaid_items    enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.cancellations  enable row level security;
alter table public.app_users      enable row level security;

-- Service-role bypasses RLS. The API routes use the service role to read
-- and write these tables. We'll add per-user policies when we wire Clerk
-- JWTs into Supabase auth, post-MVP.
