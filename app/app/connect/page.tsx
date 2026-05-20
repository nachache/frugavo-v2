import type { Metadata } from "next";
import { ConnectBankButton } from "@/components/plaid/connect-bank-button";

export const metadata: Metadata = {
  title: "Connect your bank · Frugavo",
};

// /app/connect — Plaid Link entry point.
//
// During sandbox you can use Plaid's test credentials to simulate a real
// connection:
//   Institution: any (e.g. "First Platypus Bank")
//   Username: user_good
//   Password: pass_good
//   2FA code (when prompted): 1234
// Any other combination produces specific error states for testing.

export default function ConnectPage() {
  return (
    <section className="container-page py-16 md:py-24 max-w-[640px]">
      <span className="text-[13px] font-medium text-brand">Connect</span>
      <h1 className="mt-2 font-editorial text-[32px] md:text-[40px] font-semibold tracking-[-0.025em] leading-[1.05] text-ink">
        One quick step. Then we&apos;ll find your subscriptions.
      </h1>
      <p className="mt-5 text-[16px] leading-relaxed text-ink-body">
        Frugavo uses Plaid to read your transactions. Plaid is the same
        infrastructure your bank app uses. Your bank credentials never touch
        our servers and we use a read-only scope — we can&apos;t move money,
        send messages, or change anything in your account.
      </p>

      <div className="mt-8">
        <ConnectBankButton />
      </div>

      <div className="mt-12 rounded-2xl bg-white border border-hairline/60 p-5">
        <h2 className="text-[14px] font-semibold text-ink">
          Sandbox test credentials
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-body">
          We&apos;re currently in sandbox mode. Pick any institution in the
          Plaid Link modal, then sign in with:
        </p>
        <ul className="mt-2 text-[13px] text-ink-body space-y-1">
          <li>
            Username: <code className="rounded bg-ink/[0.05] px-1.5 py-0.5">user_good</code>
          </li>
          <li>
            Password: <code className="rounded bg-ink/[0.05] px-1.5 py-0.5">pass_good</code>
          </li>
          <li>
            If asked for a 2FA code: <code className="rounded bg-ink/[0.05] px-1.5 py-0.5">1234</code>
          </li>
        </ul>
      </div>
    </section>
  );
}
