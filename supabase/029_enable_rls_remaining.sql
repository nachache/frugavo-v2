-- 029_enable_rls_remaining.sql
--
-- Closes the RLS gap on the 11 tables that shipped without it. Belt
-- and braces, not a behaviour change: today the app only ever
-- accesses Postgres through the service_role client (lib/supabase.ts
-- exports `supabaseAdmin` and nothing else), and service_role
-- inherently bypasses RLS. So no query gets denied by this migration.
--
-- What this prevents: if anyone ever adds a browser/anon Supabase
-- client to the codebase (or someone else's compromised endpoint
-- somehow obtains the anon key), these tables won't silently expose
-- billing data, payment methods, raw transactions, or webhook logs.
-- Without RLS enabled, PostgREST treats anon as authorized to SELECT
-- whatever the table's grants allow.
--
-- Why no policies: we don't *want* anon/authenticated to read these.
-- The only legitimate accessor is the server (service_role). With RLS
-- on and zero policies, the default is deny-all for everyone except
-- service_role. If we ever need a Clerk-authenticated read path on
-- one of these tables we can add a targeted policy at that point.

-- ── 004 — Plaid webhook dedup log ──────────────────────────────────
-- Global table (no user_id). Holds raw webhook metadata for replay
-- defense. Never readable by anyone but the server.
alter table plaid_webhook_events enable row level security;

-- ── 005 — Per-charge ledger ────────────────────────────────────────
-- Per-user, but only ever read server-side by buildDashboardData and
-- friends. Sensitive: contains every detected recurring charge.
alter table subscription_charges enable row level security;

-- ── 006 — Logo cache ───────────────────────────────────────────────
-- Global table (logos shared across users). Low-sensitivity, but
-- enabling RLS removes it from the surface area that anon could ever
-- enumerate.
alter table merchant_logos enable row level security;

-- ── 009 — Raw Plaid transactions + scan snapshots ──────────────────
-- The crown jewels of leak risk: every individual bank transaction
-- the user has, stored normalized. Per-user. Service-role only.
alter table plaid_transactions enable row level security;
alter table scan_snapshots enable row level security;

-- ── 017 — Stripe billing surface ───────────────────────────────────
-- Five tables that together describe every customer's plan, payment
-- method, and Stripe subscription state. Highest sensitivity in the
-- DB after raw transactions.
alter table stripe_customers enable row level security;
alter table billing_events enable row level security;
alter table subscriptions_billing enable row level security;
alter table billing_entitlements enable row level security;
alter table payment_methods_mirror enable row level security;

-- ── 021 — Billing email dispatch log ───────────────────────────────
-- Audit trail of which billing emails went to whom. Includes the
-- Resend message_id and any error string returned. Per-user.
alter table billing_email_dispatches enable row level security;

-- Note: app_users (028 modifies it) already had RLS enabled in
-- 002_app_users.sql; no change needed here.
