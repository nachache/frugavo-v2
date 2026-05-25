/**
 * npm run tsx scripts/configure-portal.ts
 *
 * One-time setup script that configures the Stripe Customer Portal
 * via the API. Idempotent — running it twice produces the same
 * config. Use this instead of clicking through Stripe Dashboard so
 * the portal config is version-controlled and identical across
 * test and live mode.
 *
 * Required env:
 *   STRIPE_SECRET_KEY  — test or live secret key
 *
 * Optional env:
 *   STRIPE_PORTAL_BUSINESS_PROFILE_PRIVACY_URL
 *   STRIPE_PORTAL_BUSINESS_PROFILE_TOS_URL
 *
 * Run:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/configure-portal.ts
 *
 * Output: prints the configuration id; save it nowhere — Stripe
 * uses the active configuration automatically.
 */

import Stripe from "stripe";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is required.");
    process.exit(1);
  }
  const stripe = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });

  const privacyUrl =
    process.env.STRIPE_PORTAL_BUSINESS_PROFILE_PRIVACY_URL ??
    "https://frugavo.com/privacy";
  const tosUrl =
    process.env.STRIPE_PORTAL_BUSINESS_PROFILE_TOS_URL ??
    "https://frugavo.com/terms";

  console.log("Creating/updating Stripe Customer Portal configuration…");

  const config = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "Manage your Frugavo protection",
      privacy_policy_url: privacyUrl,
      terms_of_service_url: tosUrl,
    },
    default_return_url: "https://frugavo.com/app/settings",
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["email", "address", "phone", "tax_id", "name"],
      },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: {
        enabled: true,
        // Always cancel at period end. Never immediate — user keeps
        // protection through what they already paid for.
        mode: "at_period_end",
        proration_behavior: "none",
        cancellation_reason: {
          enabled: true,
          options: [
            "too_expensive",
            "missing_features",
            "switched_service",
            "unused",
            "customer_service",
            "too_complex",
            "low_quality",
            "other",
          ],
        },
      },
      // Note: Stripe re-enables resume/reactivation automatically
      // when the customer toggles cancel_at_period_end off — no
      // explicit feature flag needed.
    },
  });

  // Activate this configuration as the default so the portal endpoint
  // we already wired (app/api/billing/portal) picks it up without
  // any additional code change.
  await stripe.billingPortal.configurations.update(config.id, {
    active: true,
  });

  console.log("OK. Configuration id:", config.id);
  console.log("This config is now active. No code changes required.");
}

main().catch((e) => {
  console.error("portal config failed:", e);
  process.exit(1);
});
