import type { Metadata } from "next";
import { ConnectFlow } from "@/components/plaid/connect-flow";

export const metadata: Metadata = {
  title: "Connect your bank · Frugavo",
};

// /app/connect — Plaid Link entry point.
//
// Trust signals are critical here — users hesitate the most at the
// "give an app access to my bank" moment. Reinforce with the Plaid
// badge, explicit read-only language, and a list of what we can /
// cannot do.

export default function ConnectPage() {
  return (
    <section className="container-page py-12 md:py-20 max-w-[680px]">
      <span className="text-[13px] font-medium text-brand">Connect</span>
      <h1 className="mt-2 font-display text-[30px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Connect your bank in 30 seconds.
      </h1>
      <p className="mt-4 md:mt-5 text-[15.5px] md:text-[16.5px] leading-relaxed text-ink-body">
        Frugavo uses Plaid to read your transactions — the same infrastructure
        your bank&apos;s own app uses. Your credentials never touch our
        servers.
      </p>

      {/* Trust strip — the three things people worry about, in plain text */}
      <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3">
        <TrustItem
          title="Read-only access"
          body="We can see transactions. We can't move money or send messages."
        />
        <TrustItem
          title="Plaid handles the login"
          body="Bank credentials go to Plaid directly. We never store them."
        />
        <TrustItem
          title="Bank-grade encryption"
          body="TLS in transit. Encrypted at rest. SOC 2 hosting."
        />
      </div>

      {/* The Connect button itself */}
      <div className="mt-8">
        <ConnectFlow />
      </div>

      {/* Trusted-by row — proves this isn't a sketchy connector */}
      <div className="mt-8 rounded-2xl border border-hairline bg-surface p-5 md:p-6">
        <div className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-3">
          Powered by Plaid
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href="https://plaid.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-canvas h-9 px-3.5 text-[13px] font-semibold"
          >
            <PlaidGlyph />
            <span>Plaid</span>
          </a>
          <span className="text-[13px] text-ink-body leading-snug">
            Trusted by Venmo, Robinhood, Chime, Coinbase, SoFi, and 11,000+
            banks across North America.
          </span>
        </div>
      </div>

      {/* Sandbox creds (test mode only) */}
      <div className="mt-8 rounded-2xl bg-canvas/40 border border-hairline/60 p-5">
        <h2 className="text-[14px] font-semibold text-ink">
          Sandbox test credentials
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-body">
          We&apos;re currently in sandbox mode. Pick any institution in the
          Plaid Link modal, then sign in with:
        </p>
        <ul className="mt-2 text-[13px] text-ink-body space-y-1">
          <li>
            Username:{" "}
            <code className="rounded bg-ink/[0.05] px-1.5 py-0.5">
              user_good
            </code>
          </li>
          <li>
            Password:{" "}
            <code className="rounded bg-ink/[0.05] px-1.5 py-0.5">
              pass_good
            </code>
          </li>
          <li>
            If asked for a 2FA code:{" "}
            <code className="rounded bg-ink/[0.05] px-1.5 py-0.5">1234</code>
          </li>
        </ul>
      </div>
    </section>
  );
}

function TrustItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3.5 py-3">
      <div className="flex items-center gap-2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-brand shrink-0"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <div className="text-[13.5px] md:text-[14px] font-medium text-ink">
          {title}
        </div>
      </div>
      <div className="mt-1 text-[12.5px] md:text-[13px] text-ink-body leading-snug">
        {body}
      </div>
    </div>
  );
}

// Inline Plaid glyph (simple wordmark mark). We avoid loading a
// third-party image so the trust strip never breaks if Plaid's CDN
// is down or the logo changes.
function PlaidGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
    </svg>
  );
}
