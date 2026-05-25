// Stripe SDK singleton.
//
// Pinned API version so behavior is deterministic — Stripe sometimes
// changes default response shapes between versions, and we don't want
// our projector to break because a field was renamed in a newer
// release. Bump deliberately when we want new features.
//
// Reads STRIPE_SECRET_KEY at module load. Throws if missing — but
// only on first access via getStripe(), so build-time prerendering
// in environments without secrets still works.

import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "[billing] STRIPE_SECRET_KEY is not set. Add it to .env.local (test mode: sk_test_...) and your hosting provider's env config."
    );
  }
  _client = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    // App name shows up in Stripe logs — useful when triaging
    // weird API calls in the dashboard's Events feed.
    appInfo: {
      name: "frugavo",
      version: "0.1.0",
      url: "https://frugavo.com",
    },
    // Number of retries on transient 5xx — Stripe's SDK does this
    // automatically with exponential backoff. 2 retries = 3 total
    // attempts which is the right balance for our request volume.
    maxNetworkRetries: 2,
  });
  return _client;
}

// Convenience accessors for env-driven IDs. Centralized so we get
// a clear error message rather than `undefined` flowing into a
// Stripe API call and producing a cryptic 400.

export function stripePeaceOfMindPriceId(): string {
  const v = process.env.STRIPE_PRICE_PEACE_OF_MIND_MONTHLY_V1;
  if (!v) {
    throw new Error(
      "[billing] STRIPE_PRICE_PEACE_OF_MIND_MONTHLY_V1 is not set. Copy the price_xxx id from your Stripe Dashboard test mode."
    );
  }
  return v;
}

export function stripePeaceOfMindProductId(): string {
  const v = process.env.STRIPE_PRODUCT_PEACE_OF_MIND;
  if (!v) {
    throw new Error(
      "[billing] STRIPE_PRODUCT_PEACE_OF_MIND is not set. Copy the prod_xxx id from your Stripe Dashboard test mode."
    );
  }
  return v;
}

export function stripeWebhookSecret(): string {
  const v = process.env.STRIPE_WEBHOOK_SECRET;
  if (!v) {
    throw new Error(
      "[billing] STRIPE_WEBHOOK_SECRET is not set. Will be the whsec_xxx value from Developers → Webhooks once PR 4 creates the endpoint."
    );
  }
  return v;
}
