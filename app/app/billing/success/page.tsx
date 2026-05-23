import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/billing/stripe";
import { BillingSuccessPoller } from "@/components/app/billing-success-poller";

// /app/billing/success — the post-payment landing page.
//
// Stripe redirects here with `?session_id=cs_test_xxx` after a
// successful Checkout. We:
//   1. Verify the session belongs to the current Clerk user (so a
//      stranger can't surface someone else's session)
//   2. Render the polling shell — a client component that pings
//      /api/billing/check every 800ms until entitlement_state
//      reaches trialing or active (the webhook + projector race)
//   3. Reveal "YOU'RE PROTECTED" with a soft animation when the
//      projection lands.

export const dynamic = "force-dynamic";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const sessionId = searchParams.session_id;
  if (!sessionId) {
    // Direct visit without a session id — bounce to dashboard.
    redirect("/app");
  }

  // Verify ownership BEFORE rendering anything user-specific. If the
  // session doesn't belong to this Clerk user, push them home.
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== user.id) {
      redirect("/app");
    }
  } catch {
    redirect("/app");
  }

  return (
    <section className="container-page py-12 md:py-24 max-w-[640px]">
      <BillingSuccessPoller sessionId={sessionId} />
    </section>
  );
}
