import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/billing/stripe";
import { getStripeCustomerId } from "@/lib/billing/customers";
import { portalReturnUrl } from "@/lib/billing/urls";

// POST /api/billing/portal
//
// Opens Stripe's hosted Customer Portal. The Portal handles:
//   - Updating payment methods
//   - Viewing invoice history + receipts
//   - Updating billing address
//   - Cancelling the subscription (at period end, per dashboard config)
//
// The user must already have a Stripe Customer. If they don't (i.e.
// they never started a trial), we return 409 with a hint so the
// client can redirect them to /app/billing instead.

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(_req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customerId = await getStripeCustomerId(user.id);
  if (!customerId) {
    return NextResponse.json(
      {
        error: "no_customer",
        hint: "User has never started a trial. Send them to checkout, not portal.",
      },
      { status: 409 }
    );
  }

  const stripe = getStripe();
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: portalReturnUrl(),
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[billing/portal] stripe error", e);
    const message = e instanceof Error ? e.message : "stripe_error";
    // Common cause in test mode: portal not configured yet in
    // Stripe Dashboard. Surface a useful hint.
    if (message.includes("No configuration provided")) {
      return NextResponse.json(
        {
          error: "portal_not_configured",
          hint: "Settings → Billing → Customer portal → Save in Stripe Dashboard.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "stripe_error", detail: message },
      { status: 502 }
    );
  }
}
