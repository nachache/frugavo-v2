import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getEntitlement } from "@/lib/billing/entitlements";
import { isEffectivelyPaid } from "@/lib/billing/beta";
import { StartProtectionAutoRedirect } from "@/components/app/start-protection-auto-redirect";

// /app/billing/start
//
// Entry point for the Protection-tier landing CTA. The "Start 7-day
// free trial" button on the marketing pricing card points here.
//
// Flow:
//   1. Visitor clicks Protection CTA on /  → /app/billing/start
//   2. Middleware (matcher /app/*) requires auth
//      → unauthenticated user is bounced to /sign-in → completes
//        sign-up → returns to /app/billing/start
//   3. This page checks entitlement state:
//      - Already paid / grandfathered  → /app (no need to checkout)
//      - Otherwise  → renders the auto-redirect client component
//        which POSTs /api/billing/checkout and window.locations to
//        the returned Stripe URL
//
// The 7-day free trial is configured inside the checkout-session
// creation route (subscription_data.trial_period_days = 7); no code
// here needs to know about it. The actual price comes from env
// (STRIPE_PRICE_PEACE_OF_MIND_MONTHLY_V1 — currently the $4.99 tier).

export const dynamic = "force-dynamic";

export default async function StartProtectionPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const entitlement = await getEntitlement(user.id);
  // Anyone already paid (real subscription) OR grandfathered
  // (beta_access) doesn't need checkout — send them to their
  // dashboard so they don't get a confusing double-charge prompt.
  if (isEffectivelyPaid(entitlement)) {
    redirect("/app");
  }

  return (
    <section className="container-page py-16 md:py-24 max-w-[560px]">
      <div className="text-center">
        <span className="text-[12px] md:text-[13px] font-medium text-brand uppercase tracking-[0.14em]">
          Activate Protection
        </span>
        <h1 className="mt-3 font-display text-[28px] md:text-[36px] font-bold tracking-[-0.025em] leading-[1.15] text-ink">
          Opening secure checkout…
        </h1>
        <p className="mt-4 text-[14.5px] md:text-[15.5px] leading-relaxed text-ink-body">
          You&apos;ll be redirected to Stripe to start your 7-day free trial.
          $4.99/mo after the trial. Cancel anytime.
        </p>
      </div>

      <div className="mt-10">
        <StartProtectionAutoRedirect />
      </div>
    </section>
  );
}
