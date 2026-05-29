import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getEntitlement } from "@/lib/billing/entitlements";
import { isEffectivelyPaid } from "@/lib/billing/beta";
import { RestartProtectionForm } from "@/components/app/restart-protection-form";

// /app/billing/restart
//
// Landing page for users coming back after their protection paused.
// Two entry points:
//   - "Restart Protection" button in the BillingStatusBanner
//     (past_due variant) on the dashboard
//   - "Restart Protection" link in the protection_paused dunning
//     email
//
// Behavior:
//   - past_due       → renders the restart form (Stripe Checkout)
//   - any other state→ redirects to /app (no need to be here)

export const dynamic = "force-dynamic";

export default async function RestartProtectionPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const entitlement = await getEntitlement(user.id);
  // Anyone with effective access (paid or beta) doesn't belong on
  // a restart page — they already have protection. grace_period also
  // sends home; the dunning banner handles their state on /app.
  if (
    isEffectivelyPaid(entitlement) ||
    entitlement.entitlement_state === "grace_period"
  ) {
    redirect("/app");
  }

  return (
    <section className="container-page py-12 md:py-24 max-w-[640px]">
      <div className="text-center">
        <span className="text-[12px] md:text-[13px] font-medium text-brand">
          Restart protection
        </span>
        <h1 className="mt-2 font-display text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.1] text-ink">
          Pick up where we left off.
        </h1>
        <p className="mt-3 text-[15px] md:text-[16px] leading-relaxed text-ink-body">
          Your protection paused after a series of declined payments. Restart
          with an updated card and Frugavo will resume monitoring your
          accounts immediately. Your historical data is still here — we just
          pick back up from where we stopped watching.
        </p>
      </div>

      <div className="mt-8">
        <RestartProtectionForm />
      </div>

      <div className="mt-8 text-center text-[12px] md:text-[13px] text-ink-muted">
        $14.99/month. Cancel anytime. No re-onboarding required.
      </div>
    </section>
  );
}
