# Billing setup — Stripe Dashboard checklist

One-time setup steps to perform in the Stripe Dashboard before PR 2
ships code that talks to Stripe. Everything here is operator work,
not code. Do all of it in **test mode** first; we'll repeat in live
mode before launch.

## 0. Prerequisites

- A Stripe account in test mode (you have this)
- Access to your Frugavo Netlify env var settings
- 15 minutes

## 1. Create the Product

1. Go to **Stripe Dashboard → Product catalog → Products** → **+ Add product**
2. Name: `Peace of Mind`
3. Description: `Continuous subscription protection. Frugavo watches for new charges, price hikes, trial conversions, and unusual recurring activity — and alerts you before they hit.`
4. Image: optional (square logo, 512×512)
5. Click **Add product**
6. Copy the Product ID (`prod_xxx…`) into your env as
   `STRIPE_PRODUCT_PEACE_OF_MIND`

## 2. Create the Price

On the same product page:

1. Click **+ Add another price**
2. Pricing model: **Standard pricing**
3. Price: `$14.99 USD`
4. Billing period: **Monthly** / recurring
5. Currency: USD only (we're US-nexus at launch)
6. Click **Add price**
7. Copy the Price ID (`price_xxx…`) into your env as
   `STRIPE_PRICE_PEACE_OF_MIND_MONTHLY_V1`

The `_V1` suffix matters: when we change pricing later we'll add
`_V2` rather than mutating the existing price, so existing customers
stay grandfathered.

## 3. Tax setup (Canadian company, no registration yet)

Frugavo is operated by a Canadian company. At launch we are under
the CRA $30k CAD small-supplier threshold and not yet GST/HST
registered, so **leave Stripe Tax OFF** for now.

What to still do today:

1. On the `Peace of Mind` product page → set **Tax behavior** to
   **Exclusive** (so when we flip tax on later it adds on top
   instead of being baked into the $14.99)
2. Pick **Tax code** → `txcd_10103000` (SaaS — pre-written software,
   online). This costs nothing while Tax is off and saves work later.

When to revisit:

- Approach $30k CAD in rolling 12-month revenue → register for
  GST/HST, then come back here and:
  1. **Settings → Tax → Tax settings** → toggle **Stripe Tax** on
  2. Add Canada with your GST/HST number (and QST if you have
     Quebec customers)
  3. Stripe Tax will start collecting + remitting automatically
- US customers: as a Canadian company, you generally do not owe US
  sales tax until you hit an individual state's economic-nexus
  threshold (typically $100k revenue or 200 transactions per state
  per year). Ignore for launch. Stripe Tax can flag this once
  enabled.

## 4. Configure the Billing Portal

1. **Settings → Billing → Customer portal**
2. **Functionality** → enable:
   - Customers can update payment methods ✅
   - Customers can update billing/shipping addresses ✅
   - Customers can view their invoice history ✅
   - Customers can cancel subscriptions ✅
     - Cancellation mode: **At end of billing period** (never immediate)
     - Cancellation reason prompt: **On**
3. **Subscriptions** → **Customers can switch plans**: leave OFF
   for now (we have one plan)
4. **Business information** → fill in: company name, support email,
   privacy policy URL, terms of service URL
5. Click **Save**

## 5. Configure Smart Retries (dunning)

1. **Settings → Billing → Subscriptions and emails → Manage failed payments**
2. Retry schedule: **Smart Retries** (Stripe's ML-driven retry timing)
3. Number of retry attempts: **4**
4. After final failure: **Mark subscription as unpaid** (NOT
   "cancel"). Our 21-day grace window happens at the
   `entitlement_state` layer, not at Stripe's subscription layer.
5. Send customer emails on failed payment: **Off** — we send our
   own (PR 7).

## 6. Set up the webhook endpoint

We'll register this endpoint in PR 4 when the handler exists, but
you can pre-create it now to grab the signing secret.

1. **Developers → Webhooks** → **+ Add endpoint**
2. Endpoint URL: `https://frugavo.com/api/stripe/webhook`
   (for local dev, use the Stripe CLI — see PR 4 docs)
3. Events to send: select these and only these:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_method.attached`
   - `payment_method.detached`
4. Click **Add endpoint**
5. Click **Reveal signing secret** and copy the `whsec_xxx…` value
   into your env as `STRIPE_WEBHOOK_SECRET`

## 7. Copy your API keys

1. **Developers → API keys**
2. **Secret key** → reveal and copy into env as `STRIPE_SECRET_KEY`
   (use the **test** key for now: `sk_test_…`)
3. **Publishable key** is not needed — we use Stripe Checkout
   redirect, not Stripe Elements, so the client never sees a key.

## 8. Final env var checklist

You should now have in your `.env` (local) and Netlify (deployed):

    STRIPE_SECRET_KEY=sk_test_...
    STRIPE_WEBHOOK_SECRET=whsec_...
    STRIPE_PRODUCT_PEACE_OF_MIND=prod_...
    STRIPE_PRICE_PEACE_OF_MIND_MONTHLY_V1=price_...

All four must be set in every environment (local, preview, prod) or
PR 3's checkout endpoint will fail at boot.

## 9. Run the migration

In your Supabase SQL editor (or via the CLI):

    psql "$SUPABASE_DB_URL" -f supabase/017_billing_schema.sql

Verify five new tables exist:

    \dt stripe_customers
    \dt billing_events
    \dt subscriptions_billing
    \dt billing_entitlements
    \dt payment_methods_mirror

## 10. Verify nothing user-facing changed

PR 1 is invisible to users. Load the dashboard, run a scan, click
around. Everything should behave identically to before.

If everything checks out → ship PR 2 (entitlement library).
