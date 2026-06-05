import type { Metadata } from "next";
import Link from "next/link";
import { ConnectFlow } from "@/components/plaid/connect-flow";
import { Lock, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Add your bank account · Frugavo",
};

// /app/connect — Plaid best-practices pre-Link screen.
//
// This page is the dedicated pre-Link pane required by Plaid's Link
// Messaging guidelines. The user lands here right after sign-up and
// MUST explicitly click "Add your bank account" to launch the Plaid
// Link modal. Auto-open was removed 2026-06-05 per Plaid recommendation.
//
// Required elements present (Plaid Link Messaging best practices):
//   • Financially-compelling headline
//   • ≤2 value-prop bullets, both financial benefits
//   • Plaid disclosure sentence (named, third-party trust framing)
//   • Data-use explanation (what we read + why)
//   • Disconnect notice (you can remove access anytime)
//   • Lock icon + 256-bit encryption claim
//   • "Frugavo never sees your credentials" statement
//   • Privacy Policy inline link
//   • Social proof line (11,000+ banks via Plaid)
//   • One primary CTA: "Add your bank account"
//   • No equal-weight manual-entry alternative
//
// Path stays /app/connect (no "plaid" in URL — meets Section 8).

export default function ConnectPage() {
  return (
    <section className="container-page max-w-[640px] py-10 md:py-16">
      <div className="rounded-3xl border border-hairline bg-white shadow-soft p-7 md:p-10">
        {/* Lock icon — Plaid-recommended trust signal above the CTA */}
        <div className="flex items-center justify-center mb-5">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/10 ring-1 ring-brand/20">
            <Lock size={20} strokeWidth={2.2} className="text-brand" aria-hidden />
          </span>
        </div>

        {/* Financially-compelling headline */}
        <h1 className="font-display text-[28px] md:text-[34px] font-bold tracking-[-0.025em] leading-[1.1] text-ink text-center">
          Add your bank to find every subscription you&apos;re paying for.
        </h1>

        {/* Two value-prop bullets (both financial benefits) */}
        <ul className="mt-7 space-y-3 max-w-[480px] mx-auto">
          <BulletLine>
            See every recurring charge from the last 12 months — instantly.
          </BulletLine>
          <BulletLine>
            Spot the ones you forgot about. Cancel anything in one tap.
          </BulletLine>
        </ul>

        {/* Primary CTA — opens Plaid Link only on explicit click */}
        <div className="mt-9 flex flex-col items-center">
          <ConnectFlow />
          {/* Inline privacy link directly under the CTA per Plaid guidance */}
          <p className="mt-3 text-[11.5px] text-ink-muted text-center max-w-[420px]">
            By continuing, you agree to our{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-ink transition"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* Trust block — 256-bit encryption + credential safety + Plaid disclosure */}
        <div className="mt-9 pt-7 border-t border-hairline/60 space-y-4 text-[13px] text-ink-body leading-relaxed">
          <TrustItem
            icon={<ShieldCheck size={14} strokeWidth={2.2} className="text-brand" aria-hidden />}
          >
            <span className="text-ink font-semibold">
              Secured with 256-bit encryption.
            </span>{" "}
            Frugavo never sees your bank username or password. You
            authenticate directly with your bank through Plaid&apos;s secure
            flow.
          </TrustItem>

          <TrustItem
            icon={<Lock size={14} strokeWidth={2.2} className="text-brand" aria-hidden />}
          >
            <span className="text-ink font-semibold">
              You&apos;ll continue in Plaid.
            </span>{" "}
            Plaid is a secure third-party service trusted by thousands of
            apps (Venmo, Robinhood, Chime). Frugavo receives read-only
            access to your transactions — never your login details.
          </TrustItem>

          <TrustItem
            icon={<ShieldCheck size={14} strokeWidth={2.2} className="text-brand" aria-hidden />}
          >
            <span className="text-ink font-semibold">
              We only read transactions.
            </span>{" "}
            We never read emails, sell your data, or access any other
            account information. Disconnect your bank and delete every
            byte of your data from settings anytime — instant and
            irreversible.
          </TrustItem>
        </div>

        {/* Social proof line — Plaid-recommended trust signal */}
        <p className="mt-7 pt-5 border-t border-hairline/60 text-[12px] text-ink-muted text-center">
          Trusted infrastructure · 11,000+ banks supported via Plaid
        </p>
      </div>
    </section>
  );
}

function BulletLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] text-ink-body leading-relaxed">
      <span
        aria-hidden
        className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-brand shrink-0"
      />
      <span>{children}</span>
    </li>
  );
}

function TrustItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand/8 shrink-0 mt-0.5">
        {icon}
      </span>
      <p className="min-w-0">{children}</p>
    </div>
  );
}
