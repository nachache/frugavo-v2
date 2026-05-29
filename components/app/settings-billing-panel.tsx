import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { getEntitlement } from "@/lib/billing/entitlements";
import { OpenPortalButton } from "./settings-portal-button";

// Settings → Billing panel. Server component that reads the user's
// entitlement and renders the right copy + action based on state:
//
//   none / expired     — pitch Activate Protection ($14.99/mo, 7d free)
//   trialing           — trial countdown + manage billing link
//   active             — protected, manage billing
//   cancelled_active   — protection ending, resume from portal
//   grace_period       — payment issue, update card via portal
//   past_due           — protection paused, restart link

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function BillingPanel() {
  const user = await currentUser();
  if (!user) return null;
  const ent = await getEntitlement(user.id);

  // Beta-era unlock: replaces the activation pitch when the user
  // is operating on Founder Access. Keep the premium positioning
  // (every protection feature listed); strip the price pressure.
  if (ent.entitlement_state === "beta_access") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-brand/30 bg-brand/[0.04] p-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/12 border border-brand/25 px-2.5 h-6 text-[11px] font-medium text-brand uppercase tracking-[0.08em]">
            Founder Access
          </div>
          <div className="mt-2.5 text-[15.5px] font-medium text-ink">
            Every protection feature is unlocked.
          </div>
          <p className="mt-1.5 text-[13.5px] text-ink-body leading-relaxed">
            You&apos;re part of Frugavo&apos;s early access. There&apos;s
            nothing to bill — your account stays open while we&apos;re
            still learning what makes the product most useful.
          </p>
          <p className="mt-3 text-[12px] text-ink-muted leading-relaxed">
            Frugavo will eventually be a paid product. We&apos;ll give
            you plenty of notice before anything changes for your
            account.
          </p>
        </div>
      </div>
    );
  }

  if (
    ent.entitlement_state === "trialing" ||
    ent.entitlement_state === "active"
  ) {
    const isTrialing = ent.entitlement_state === "trialing";
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-hairline bg-surface p-4">
          <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Plan
          </div>
          <div className="mt-1 text-[15.5px] font-medium text-ink">
            Peace of Mind · $14.99/mo
          </div>
          {isTrialing && ent.trial_ends_at && (
            <div className="mt-1 text-[13px] text-ink-body">
              You&apos;re on a 7-day free trial. First charge: {fmtWhen(ent.trial_ends_at)}.
            </div>
          )}
          {!isTrialing && (
            <div className="mt-1 text-[13px] text-ink-body">
              Active. Billed monthly. Cancel any time from the portal.
            </div>
          )}
        </div>
        <OpenPortalButton />
      </div>
    );
  }

  if (ent.entitlement_state === "cancelled_active") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-accent">
            Ending soon
          </div>
          <div className="mt-1 text-[14.5px] text-ink">
            You cancelled — protection ends {fmtWhen(ent.expires_at)}. You can resume any time before then.
          </div>
        </div>
        <OpenPortalButton label="Open billing portal" />
      </div>
    );
  }

  if (ent.entitlement_state === "grace_period") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-accent">
            Payment issue
          </div>
          <div className="mt-1 text-[14.5px] text-ink">
            Last charge didn&apos;t go through. Monitoring is still on while
            Stripe retries — update your card to keep it that way.
          </div>
        </div>
        <OpenPortalButton label="Update payment method" />
      </div>
    );
  }

  if (ent.entitlement_state === "past_due") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-danger">
            Protection paused
          </div>
          <div className="mt-1 text-[14.5px] text-ink">
            Three weeks of declined retries — monitoring is paused. Restart any time and we resume immediately.
          </div>
        </div>
        <Link
          href="/app/billing/restart"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-medium text-white hover:bg-brand-hover transition"
        >
          Restart protection
        </Link>
      </div>
    );
  }

  // none / expired — pitch activation
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-hairline bg-surface p-4">
        <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-brand">
          Peace of Mind
        </div>
        <div className="mt-1 text-[15.5px] font-medium text-ink">
          $14.99/mo · 7 days free
        </div>
        <p className="mt-1.5 text-[13.5px] text-ink-body leading-relaxed">
          Continuous monitoring across every connected account. Cancel any
          time from the portal. The free scan stays free — you only pay
          for ongoing protection.
        </p>
      </div>
      <Link
        href="/app/protection"
        className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-medium text-white hover:bg-brand-hover transition"
      >
        See what Protection includes
      </Link>
    </div>
  );
}
