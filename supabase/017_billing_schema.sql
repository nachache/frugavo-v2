-- 017_billing_schema.sql
--
-- Billing & entitlement projection layer.
--
-- Architecture: Stripe owns money (cards, invoices, dunning, tax,
-- retries). Postgres owns access (does this user have Peace of Mind
-- right now, when does it expire, are they in grace).
--
-- The app NEVER calls Stripe on the read path. Every entitlement
-- check is a single Postgres row read (cached in Redis 30s by the
-- application layer).
--
-- Five tables:
--   stripe_customers          — lazy 1:1 Clerk user → Stripe Customer
--   billing_events            — immutable raw webhook log
--   subscriptions_billing     — local projection of Stripe Subscription
--   billing_entitlements      — hot-path access table
--   payment_methods_mirror    — display-only card metadata
--
-- Invariant: billing_entitlements is the ONLY table the request hot
-- path reads. Everything else is for projection, audit, and admin.

-- =====================================================================
-- 1. stripe_customers
-- =====================================================================
-- Lazy mapping: row is created on first checkout, never preemptively.
-- We don't auto-create a Stripe Customer for every Clerk signup;
-- that would pollute Stripe with millions of unused customer
-- records.

create table if not exists stripe_customers (
  clerk_user_id      text primary key,
  stripe_customer_id text not null unique,
  email              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists stripe_customers_customer_idx
  on stripe_customers (stripe_customer_id);

-- =====================================================================
-- 2. billing_events
-- =====================================================================
-- Immutable audit log of every Stripe webhook we've ever received.
-- Persist BEFORE acking Stripe; project asynchronously. If projection
-- breaks, the raw events let us replay deterministically.
--
-- event_id is Stripe's evt_xxx, used for idempotency. ON CONFLICT DO
-- NOTHING on insert means duplicate webhook deliveries are no-ops.

create table if not exists billing_events (
  id                 uuid primary key default gen_random_uuid(),
  event_id           text not null unique,           -- Stripe evt_xxx
  event_type         text not null,                  -- e.g. invoice.payment_succeeded
  stripe_customer_id text,                           -- denormalized for query
  payload            jsonb not null,                 -- raw event.data.object
  api_version        text,
  livemode           boolean not null default false,
  received_at        timestamptz not null default now(),
  -- Projection bookkeeping. Null = not yet projected.
  projected_at       timestamptz,
  projection_error   text
);

create index if not exists billing_events_customer_idx
  on billing_events (stripe_customer_id, received_at desc);

create index if not exists billing_events_unprojected_idx
  on billing_events (received_at)
  where projected_at is null;

create index if not exists billing_events_type_idx
  on billing_events (event_type, received_at desc);

-- =====================================================================
-- 3. subscriptions_billing
-- =====================================================================
-- Local projection of Stripe Subscription. One row per Stripe
-- subscription id. Updated by the projector after each webhook.
--
-- stripe_status mirrors Stripe's own status (trialing, active,
-- past_due, canceled, unpaid, incomplete, etc.). Our application
-- state (billing_entitlements.entitlement_state) is derived from it.

create table if not exists subscriptions_billing (
  stripe_subscription_id text primary key,           -- sub_xxx
  stripe_customer_id     text not null,
  clerk_user_id          text not null,
  price_id               text not null,              -- price_xxx
  stripe_status          text not null,              -- trialing | active | past_due | canceled | unpaid | incomplete | incomplete_expired
  cancel_at_period_end   boolean not null default false,
  trial_start            timestamptz,
  trial_end              timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  canceled_at            timestamptz,
  ended_at               timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_billing_user_idx
  on subscriptions_billing (clerk_user_id);

create index if not exists subscriptions_billing_customer_idx
  on subscriptions_billing (stripe_customer_id);

create index if not exists subscriptions_billing_status_idx
  on subscriptions_billing (stripe_status)
  where stripe_status in ('trialing', 'active', 'past_due');

-- =====================================================================
-- 4. billing_entitlements
-- =====================================================================
-- The hot-path table. Every gated request reads ONE row from here.
-- Application caches it in Redis for 30s.
--
-- Key is (clerk_user_id, feature). For now there's a single feature
-- 'peace_of_mind'; the column exists so we can add tiers later
-- (e.g. 'family', 'business') without schema changes.
--
-- entitlement_state is the canonical access state derived by the
-- projector:
--   none             — never paid, no trial active
--   trialing         — inside the 7-day trial window
--   active           — paying customer, healthy
--   grace_period     — payment failed but within 21-day dunning window
--   cancelled_active — user cancelled, still has access until period_end
--   past_due         — grace exhausted, monitoring paused
--   expired          — cancelled_active period ended
--
-- hasAccess() returns true for: trialing, active, grace_period,
-- cancelled_active. False for: none, past_due, expired.

create table if not exists billing_entitlements (
  clerk_user_id          text not null,
  feature                text not null default 'peace_of_mind',
  entitlement_state      text not null default 'none' check (entitlement_state in (
    'none',
    'trialing',
    'active',
    'grace_period',
    'cancelled_active',
    'past_due',
    'expired'
  )),
  stripe_subscription_id text,                       -- null when state='none'
  trial_ends_at          timestamptz,
  expires_at             timestamptz,                -- period_end for cancelled_active, dunning_exhausted_at for grace
  source_event_id        text,                       -- last billing_events.event_id that updated this row
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  primary key (clerk_user_id, feature)
);

create index if not exists billing_entitlements_state_idx
  on billing_entitlements (entitlement_state)
  where entitlement_state in ('trialing', 'grace_period', 'cancelled_active', 'past_due');

create index if not exists billing_entitlements_expires_idx
  on billing_entitlements (expires_at)
  where expires_at is not null;

-- =====================================================================
-- 5. payment_methods_mirror
-- =====================================================================
-- Display-only metadata. NEVER stores card numbers, CVCs, or any
-- PCI-scope data. Brand + last4 + exp month/year only, so the
-- dashboard can render "Visa ending 4242 — exp 04/2027" without
-- a Stripe API call.

create table if not exists payment_methods_mirror (
  stripe_payment_method_id text primary key,         -- pm_xxx
  stripe_customer_id       text not null,
  clerk_user_id            text not null,
  brand                    text,                     -- visa, mastercard, amex...
  last4                    text,
  exp_month                smallint,
  exp_year                 smallint,
  is_default               boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists payment_methods_mirror_user_idx
  on payment_methods_mirror (clerk_user_id);

create index if not exists payment_methods_mirror_default_idx
  on payment_methods_mirror (clerk_user_id)
  where is_default = true;

-- =====================================================================
-- updated_at triggers
-- =====================================================================
-- Standard "touch updated_at on UPDATE" pattern. Keeps the column
-- accurate without depending on application code remembering.

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists stripe_customers_touch on stripe_customers;
create trigger stripe_customers_touch
  before update on stripe_customers
  for each row execute function touch_updated_at();

drop trigger if exists subscriptions_billing_touch on subscriptions_billing;
create trigger subscriptions_billing_touch
  before update on subscriptions_billing
  for each row execute function touch_updated_at();

drop trigger if exists billing_entitlements_touch on billing_entitlements;
create trigger billing_entitlements_touch
  before update on billing_entitlements
  for each row execute function touch_updated_at();

drop trigger if exists payment_methods_mirror_touch on payment_methods_mirror;
create trigger payment_methods_mirror_touch
  before update on payment_methods_mirror
  for each row execute function touch_updated_at();
