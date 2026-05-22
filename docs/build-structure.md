# Frugavo — Build Structure

Living document. Edit as decisions land. Sections marked DECIDED are
locked. Sections marked OPEN need a call.

## 1. Product framing

Frugavo is a "continuous financial protection" product, not a budgeting
tool. Every UX decision flows from one rule:

> The user must feel that monitoring is silently happening, that they
> are protected, that the system is calm and trustworthy. They are
> never "managing software." They are "covered."

Copy never says: subscribed, paid, purchased, plan, software, app.
Copy always says: protected, covered, watching, monitoring, your
protection.

## 2. What exists today

Engine and data layer:
- Plaid sync via `/transactions/sync` cursor flow
- Deterministic recurrence detection (no AI in math)
- Replayable scans stamped with `scanner_version`
- Stable subscription identity via `subscription_key`
- `subscription_charges` ledger backs every chart
- Gate A classifier + LLM tiebreak + shadow probabilistic scorer
- Beta-Binomial merchant priors + calibrated logistic over features
- User overrides via `/api/feedback`
- Active learning band surfaces uncertain candidates

Dashboard (one block, no duplicates):
- IdentityHero (personality + social-logo share buttons that share PNG)
- OverviewCard (canonical monthly upkeep + animated sparkline + donut
  + insights merged in)
- WhatChangedCard (auto-hides when nothing to show)
- UncertainPromptCards (auto-hides when no candidates)
- ActionCenter (Worth a look / Watching / Pruned / Hidden / All tabs,
  Cancel + Keep + Review buttons hover-revealed, modal portaled to
  body, cancellation celebration animation)
- Detail page at `/app/subscriptions/[id]` with full billing history,
  price-change timeline, accepted/outlier badges

Onboarding:
- Progressive reveal sequence at `/app/welcome` on first scan
- 9 stages: subscription count, monthly burn, yearly, AI stack,
  category, biggest sub, money leaks, shock insight, personality
- Auto-advances, tap to skip

Marketing surfaces:
- Home page with "Your subscription watchdog" hero
- Meta tags rewritten for accurate framing
- Share cards: monthly_burn, yearly_total, ai_stack, identity,
  wrapped (1080x1920 IG story format)
- Web Share API with files — shares the PNG, not the link

Admin:
- `/app/admin/models` — table of `model_versions`, rollout sliders,
  promote-to-default flow
- `/api/cron/retrain-scoring-model` — weekly logistic fitter, needs
  20+ feedback events to produce a candidate model

Persistence:
- `user_preferences` table — survives sessions
- `user_overrides` keyed by `(user_id, merchant_key)` — survives
  re-scans and version bumps
- `merchants.alpha/.beta` — network signal, updated on every label
- `feedback_events` — immutable audit log for retrains

## 3. Monetization model — DECIDED

Plan: Peace of Mind
Price: $14.99 USD/month
Trial: 7 days, card required upfront, no feature restrictions
Annual: not at launch. Add later at 17% off framed as "2 months free."
Tax: Stripe Tax ON, US nexus only
Payment methods: card + Apple Pay + Google Pay only at launch
Dunning: moderate — 21-day grace window, monitoring pauses on day 14
of grace, never instant cut after first failure

CTA copy:
- Button: "Activate Protection"
- Sub-line: "7 days free. Cancel anytime."
- Never frame as "trial" or "subscribe."

Trial framing:
- "Protection is now active."
- Not "You're evaluating software."
- First protection scan runs immediately on signup.

## 4. Billing architecture — DECIDED

### Source of truth split

Stripe owns money: invoices, dunning, card data, tax, retries.
Postgres owns access: did this user pay, are they in grace, when does
their access expire.

The app NEVER calls Stripe on the read path. Every entitlement check
is a single Postgres row read (cached in Redis 30s).

### Three principles

1. Stripe is not the source of truth alone. It is the source of
   payment truth. Access truth lives locally.
2. Webhooks are unreliable. Design for: late delivery, out-of-order
   delivery, duplicate delivery, never delivered.
3. Entitlement check = single Postgres row read + 30s Redis cache.
   Nothing else on the request hot path.

### Schema (migration 017)

Five tables:
- `stripe_customers` — lazy 1:1 mapping Clerk user → Stripe Customer
- `billing_events` — immutable raw webhook log
- `subscriptions_billing` — local projection of Stripe Subscription
- `billing_entitlements` — denormalized hot-path table, one row per
  `(clerk_user_id, feature)`, the table everything reads
- `payment_methods_mirror` — display-only card metadata

### Entitlement state machine

```
none ──checkout.completed──→ active
none ──trial.start────────→ trialing
trialing ──trial.end + pay→ active
trialing ──trial.end + fail→ past_due
active ──cancel_at_period_end→ cancelled_active
cancelled_active ──period_end reached→ expired
active ──invoice.payment_failed→ grace_period
grace_period ──invoice.payment_succeeded→ active
grace_period ──dunning_exhausted→ past_due
past_due ──manual restart→ active
```

`hasAccess` returns true for: active, trialing, grace_period,
cancelled_active. Returns false for: none, past_due, expired.

### Webhook pipeline

Six stages, each independently observable:

1. Signature verification (`stripe.webhooks.constructEvent`)
2. Idempotency check (Redis dedupe set, 7d TTL, keyed on event.id)
3. Durable persistence (insert into `billing_events` with
   `ON CONFLICT DO NOTHING`)
4. Return 200 to Stripe within 100ms
5. Async projection: `reduceEvents(events) → { subscription,
   entitlement }`, transacted into the projection tables
6. Cache bust + side effects (welcome email, queue first scan)

The projector is a pure function. Replaying all events for a customer
produces the same final state. This is the disaster-recovery promise.

### Common mistakes already avoided in the design

- No client-side entitlement checks. Every gate is server-side.
- No `stripe.subscriptions.retrieve()` on the read path.
- No synchronous webhook processing. Persist → ack → project async.
- No `cancel_now` on user click. Always `cancel_at_period_end`.
- No instant access removal on payment failure. Grace period of 21
  days with monitoring still on for the first 14.
- No "Customer auto-created with Clerk user." Lazy on first checkout.
- No raw card data stored. Brand/last4/exp only, display-only.

## 5. Implementation sequence (10 PRs)

Each PR is independently shippable. Order minimizes risk.

### PR 1 — Schema + Stripe catalog setup
- `supabase/017_billing_schema.sql` — five tables
- `docs/billing-setup.md` — Stripe Dashboard checklist for operator
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_PEACE_OF_MIND_MONTHLY_V1`,
  `STRIPE_PRODUCT_PEACE_OF_MIND`
- Operator creates Product/Price in Stripe Dashboard, enables Tax,
  configures Billing Portal, sets Smart Retries.

Verify: migration runs cleanly, site behaves identically.

### PR 2 — Customer + entitlement library
- `lib/billing/stripe.ts` — pinned SDK
- `lib/billing/customers.ts` — `getOrCreateCustomer(clerkUserId)` with
  Redis lock + Postgres unique
- `lib/billing/entitlements.ts` — `hasAccess`, `getEntitlement`,
  `invalidateEntitlementCache` with 30s cache
- `lib/billing/projector.ts` — pure `reduceEvents()` function

Behavior unchanged for users. `hasAccess` returns false for everyone
until first paid signup.

### PR 3 — Checkout + portal endpoints
- `POST /api/billing/checkout` — body `{ price_slug }`, returns
  `{ url }`. Creates Stripe Checkout session with 7-day trial,
  card required, US tax enabled, `client_reference_id = clerkUserId`.
- `GET /api/billing/check?session_id=X` — returns entitlement_state
- `POST /api/billing/portal` — returns billing portal URL

Verify in Stripe test mode using card `4242 4242 4242 4242`.

### PR 4 — Webhook handler + projector
- `POST /api/stripe/webhook` — signature verify, dedupe, persist,
  ack within 100ms, async project
- `lib/billing/project.ts` — reads last 20 events, reduces, transacts
- Empty side-effect stubs in `lib/billing/side-effects.ts`

Events handled: `checkout.session.completed`,
`customer.subscription.created/updated/deleted`,
`invoice.payment_succeeded/failed`.

Verify: complete a test checkout, see DB row in `subscriptions_billing`
with `stripe_status='trialing'` within 2s.

### PR 5 — Post-payment experience + activation
- `app/app/billing/success/page.tsx` — server component, verifies
  session belongs to current user, renders polling shell
- `components/app/billing-success-poller.tsx` — polls every 800ms,
  three states: "Setting up", "Still finalising", "YOU'RE PROTECTED"
- `lib/billing/side-effects.ts onActivation` — queues first protection
  scan, logs welcome email TODO (PR 7 wires real emails), defaults
  notification preferences (instant on, digest off)
- Dashboard renders new "Activate Protection" card above IdentityHero
  when `entitlement_state in ('none', 'expired', 'past_due')`.

### PR 6 — Route gating + free vs paid boundaries

DECIDED gating (confirmed by Frugavo product team):
- `/api/scoring/uncertain` — paid only
- `/api/feedback` — write always allowed; re-scoring side effect paid
- WhatChangedCard on dashboard — paid only
- UncertainPromptCards on dashboard — paid only
- `/app/subscriptions/[id]` price-change timeline — paid only
- `/app/subscriptions/[id]` header + 12mo chart — free preview
- `/app/share` — fully free (sharing is marketing)
- Full billing history list on detail page — free preview, no gate

The main dashboard (Overview + Insights + ActionCenter) stays visible
for free users. The scan IS the value demo. The paywall is for the
continuous-monitoring layer.

Files:
- `middleware.ts` — entitlement check for gated routes
- `lib/billing/gates.ts` — `assertEntitled(req, feature)` for server
  handlers

### PR 7 — Dunning UX + email triggers
- `components/app/billing-status-banner.tsx` — top-of-dashboard banner
  for grace_period / past_due / cancelled_active states
- `lib/billing/emails.ts` — eight email types triggered by the
  projector, idempotent on `(user_id, email_type, billing_event_id)`
- `lib/billing/scheduled-dunning.ts` — daily cron for day-3/10/18
  dunning emails based on `expires_at - now()` delta
- Email provider: Resend ($20/mo). Templates via react-email.

Email sequence:
- T+0: "You're protected" (trial start)
- T+6d: "Your trial converts tomorrow — $14.99/month"
- T+0h on first decline: "Heads up — your card was declined"
- T+72h: "Still here — try a different card?"
- T+10d: "Your protection ends in 11 days"
- T+18d: "Your protection ends in 3 days"
- T+21d past_due: "Your protection has paused"
- On cancellation period_end: "We'll miss you"

### PR 8 — Reconciler + admin tooling
- `app/api/cron/reconcile-billing/route.ts` — daily cron, lists all
  Stripe subscriptions in active/trialing/past_due, joins to local
  projection, surfaces mismatches
- `app/app/admin/billing/page.tsx` — operator dashboard:
  - Active / trialing / grace / past_due counts
  - 7-day churn count
  - Per-customer event log viewer
  - "Replay events" button to re-project from raw events
- Gated to `FRUGAVO_ADMIN_USER_IDS`

### PR 9 — Cancellation flow + reactivation polish
- `scripts/configure-portal.ts` — one-time Stripe portal config
- `app/app/billing/restart/page.tsx` — past_due reactivation
- Copy review pass — purge "subscribed/purchased/paid" everywhere

### PR 10 — Monitoring intelligence (the actual paid feature)
- New subscription detection — scan diff against prior snapshot
- Price increase detection — cycle-over-cycle amount comparison ≥5%
- Renewal awareness — 5 days before `next_expected_charge_at`
- Unusual recurring charge detection — merchant_key quiet for 90+
  days then charge resumes
- All emit events into a `monitoring_alerts` table
- In-app notifications surface in a new "Alerts" section
- Email digest summarizes weekly

This is what Peace of Mind users actually pay for.

## 6. Build order — KEY DECISION

The chicken-and-egg question: do we build the payment system or
Peace of Mind itself first?

DECISION: Peace of Mind product first. Payment infra in parallel but
hidden.

Reasoning:

Selling protection that doesn't exist is dishonest. The trial
experience would be hollow — the "first protection scan" in the
success screen is the same as a free scan because we have no
continuous monitoring yet. Users would pay for an empty promise.

But PRs 1-4 of the billing system are pure backend (schema,
libraries, webhook plumbing). They can land before PR 10 ships
without exposing any UI to users. So the practical order is:

1. PR 10 (monitoring intelligence) — the actual product
2. PR 1-4 of billing — schema, library, checkout endpoint,
   webhook handler — landed in parallel, no user-facing entrypoint
3. PR 5-6 (post-payment UX + gating) — flip the switch, billing
   becomes live
4. PR 7-9 (dunning, reconciler, polish) — production hardening

Net effect: the day the "Activate Protection" button goes live, the
product behind it is real. The trial actually delivers value. The
success screen "Your subscriptions are being watched" is true.

## 7. Open questions

OPEN:
- Email provider final choice (Resend recommended, alternatives
  Postmark or AWS SES). Lock before PR 7.
- Whether to capture phone number at signup for SMS alerts later.
  Default: no, keep signup friction minimal.
- Refund policy. Recommended: 7-day satisfaction refund within trial,
  no proration refunds after.

## 8. Pre-launch QA checklist (before going live to public)

- 20+ test signups across happy path, failed payment, cancellation,
  reactivation, expired card, 3DS challenge
- Switch to Stripe live mode, take a real payment from self, verify
  end-to-end
- Reconciler running on schedule
- Webhook delivery verified at 99%+ success in Stripe Dashboard
- All eight email templates rendered and reviewed
- Privacy policy + terms of service updated to mention recurring
  billing, monitoring, data retention
- Refund policy public
- Support inbox monitored

## 9. Post-launch metrics to watch

Activation funnel:
- Click "Activate Protection" → land Stripe Checkout
- Complete card entry → checkout.session.completed
- Land success page → see "YOU'RE PROTECTED" reveal
- Trial-to-paid conversion at day 8

Retention:
- 30-day retention of paid users
- Cancel-during-trial rate
- Cancel-after-paying-once rate
- Grace-period-to-recovered rate

Operational:
- Webhook delivery success rate
- Projection lag (event timestamp → entitlement row updated)
- Reconciler mismatch count per day
