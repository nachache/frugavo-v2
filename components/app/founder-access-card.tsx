// FounderAccessCard — the beta-era counterpart to
// ActivateProtectionCard.
//
// Renders when entitlement.entitlement_state === "beta_access". The
// goal is to communicate something specific to the user:
//
//   "You have a premium protection product. It's fully unlocked
//    for you during this early access. We are not charging you
//    right now because we are still learning."
//
// Visually it sits in the same slot in the IA where the activate
// card used to sit (Layer 3 — monitoring / protection). Tone is
// quiet privilege, not promotional. No CTAs, no upgrade pressure,
// no "act now."
//
// When BETA_MODE_ENABLED flips false, this component simply stops
// rendering — the page logic falls through to ActivateProtectionCard
// for users whose real state is none / expired / past_due. No
// migration. No coordination. Just an env flip.

import { Sparkles } from "lucide-react";

export function FounderAccessCard() {
  return (
    <div className="card-window rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      <div className="flex items-start gap-3 md:gap-4">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand/15 shrink-0">
          <Sparkles size={18} className="text-brand" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 h-6 text-[11px] font-medium text-brand uppercase tracking-[0.08em]">
            Founder Access
          </div>
          <h3 className="mt-2.5 font-display text-[18px] md:text-[20px] font-semibold tracking-[-0.01em] text-ink leading-snug">
            Your protection is fully unlocked.
          </h3>
          <p className="mt-1.5 text-[13.5px] md:text-[14px] text-ink-body leading-relaxed">
            You&apos;re among the first to use Frugavo. Every protection
            feature — continuous monitoring, price-change alerts,
            cancellation-assist, multi-account coverage — is active for
            your account. No subscription required during early access.
          </p>

          {/* What you have */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <FeatureLine label="Continuous monitoring" />
            <FeatureLine label="Trial-conversion alerts" />
            <FeatureLine label="Price-change alerts" />
            <FeatureLine label="Cancellation-assist" />
            <FeatureLine label="Multi-account coverage" />
            <FeatureLine label="Subscription intelligence" />
          </div>

          {/* Quiet honesty about the relationship — no countdown,
              no urgency, no "until X date." */}
          <p className="mt-4 pt-4 border-t border-hairline/60 text-[12px] text-ink-muted leading-relaxed">
            Frugavo will eventually be a paid product. While we&apos;re
            still learning what makes it most useful, your access stays
            open and free. We&apos;ll give you plenty of notice before
            anything changes.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-body">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand shrink-0"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
