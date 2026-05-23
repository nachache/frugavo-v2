import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import {
  getStripe,
  stripePeaceOfMindPriceId,
} from "@/lib/billing/stripe";
import { getOrCreateStripeCustomer } from "@/lib/billing/customers";
import { checkoutSuccessUrl, checkoutCancelUrl } from "@/lib/billing/urls";

// POST /api/billing/checkout
//
// Creates a Stripe Checkout Session for the Peace of Mind plan and
// returns the hosted Checkout URL. The client redirects to it.
//
// Flow:
//   1. Authenticated user clicks "Activate Protection"
//   2. Client POSTs here with body `{ price_slug }`
//   3. We look up or create their Stripe Customer (lazy)
//   4. Create a Checkout Session: 7-day trial, card required upfront,
//      client_reference_id = clerk user id so webhooks can attribute
//   5. Return { url } so client does window.location = url
//
// We use Stripe-hosted Checkout (not Elements). Stripe handles 3DS,
// Apple Pay, Google Pay, address collection, tax (when enabled), and
// PCI scope. We never see card data.

export const runtime = "nodejs";
export const maxDuration = 10;

type Body = {
  price_slug?: string;
};

// Map of public-facing slug → env var holding the Stripe price id.
// Adding a new tier later (e.g. annual) means adding a row here.
const PRICE_SLUGS: Record<string, () => string> = {
  peace_of_mind_monthly: stripePeaceOfMindPriceId,
};

const DEFAULT_SLUG = "peace_of_mind_monthly";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // Empty body is acceptable — we'll default the slug.
  }

  const slug = body.price_slug ?? DEFAULT_SLUG;
  const priceResolver = PRICE_SLUGS[slug];
  if (!priceResolver) {
    return NextResponse.json(
      { error: "unknown_price_slug", slug },
      { status: 400 }
    );
  }

  let priceId: string;
  try {
    priceId = priceResolver();
  } catch (e) {
    return NextResponse.json(
      {
        error: "price_not_configured",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 }
    );
  }

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  let customerId: string;
  try {
    customerId = await getOrCreateStripeCustomer({
      clerkUserId: user.id,
      email,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[billing/checkout] customer creation failed", e);
    return NextResponse.json(
      { error: "customer_creation_failed" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      // 7-day trial, card required upfront. If no payment method is
      // ever attached (shouldn't happen since we require one at
      // Checkout), Stripe cancels the subscription.
      subscription_data: {
        trial_period_days: 7,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: {
          clerk_user_id: user.id,
        },
      },
      // Force collection of a payment method even though there's a
      // trial. This is what the build doc requires.
      payment_method_collection: "always",
      // Promo codes are useful for launch experiments and waitlist
      // converts. Cheap to enable.
      allow_promotion_codes: true,
      // Stripe Tax is disabled at launch (Canadian small-supplier).
      // When we enable it, flip this to true.
      automatic_tax: { enabled: false },
      // Billing address collection — required for Tax later, and
      // useful even now for chargeback defense.
      billing_address_collection: "auto",
      success_url: checkoutSuccessUrl(),
      cancel_url: checkoutCancelUrl(),
      metadata: {
        clerk_user_id: user.id,
        slug,
      },
    });

    if (!session.url) {
      // Shouldn't happen — Stripe always returns url for subscription
      // mode with redirect-style integration.
      return NextResponse.json(
        { error: "stripe_returned_no_url" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[billing/checkout] stripe error", e);
    const message = e instanceof Error ? e.message : "stripe_error";
    return NextResponse.json(
      { error: "stripe_error", detail: message },
      { status: 502 }
    );
  }
}
