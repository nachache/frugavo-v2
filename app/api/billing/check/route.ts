import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/billing/stripe";
import {
  getEntitlement,
  invalidateEntitlementCache,
} from "@/lib/billing/entitlements";

// GET /api/billing/check?session_id=cs_xxx
//
// Polled by the post-payment success page (PR 5). Returns the
// current entitlement_state plus session-level signals (payment +
// session status) so the page can render the right "Setting up" /
// "Still finalising" / "YOU'RE PROTECTED" message.
//
// Security: the session_id is in the URL so a malicious user might
// try to poll someone else's session. We retrieve the session from
// Stripe and verify session.client_reference_id matches the current
// Clerk user. If not, 403.
//
// Cache invalidation: every successful check explicitly busts the
// entitlement cache so the next dashboard render sees the new state
// without waiting for the 30s TTL.

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[billing/check] stripe retrieve failed", e);
    return NextResponse.json(
      { error: "session_not_found" },
      { status: 404 }
    );
  }

  if (session.client_reference_id !== user.id) {
    // Session belongs to someone else. Refuse rather than leak any
    // session-level info.
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Bust the cache so the read below sees the freshest projector
  // output if a webhook just landed.
  await invalidateEntitlementCache(user.id);
  const ent = await getEntitlement(user.id);

  return NextResponse.json({
    entitlement_state: ent.entitlement_state,
    stripe_subscription_id: ent.stripe_subscription_id,
    trial_ends_at: ent.trial_ends_at,
    expires_at: ent.expires_at,
    // Session-level signals the poller uses to decide whether to keep
    // polling or render the final reveal.
    session_status: session.status, // open | complete | expired
    payment_status: session.payment_status, // paid | unpaid | no_payment_required
  });
}
