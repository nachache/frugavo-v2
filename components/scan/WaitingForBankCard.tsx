"use client";

import { Clock, Mail, ShieldCheck } from "lucide-react";

// v11 — Plaid Classic / slow-bank state.
//
// Reached only when the engine emits `awaiting_bank_data` — meaning
// the first-connect scan exhausted its sync retry budget without
// Plaid releasing ANY transactions. Banks on Plaid's Classic
// integration tier (Wealthsimple, many Canadian credit unions, some
// smaller US banks) can take 15min to several hours for the initial
// transaction pull.
//
// Contract:
//   - Honest copy. We never claim it'll be "soon" or "5 more
//     minutes" because we genuinely don't know — Plaid does the
//     pull, we just wait on their webhook.
//   - The "Go to dashboard" path is recovery, not surrender. The
//     scan will re-trigger automatically (webhook
//     SYNC_UPDATES_AVAILABLE / INITIAL_UPDATE) when Plaid delivers,
//     and the dashboard will populate live whether the user is
//     looking or not.
//   - We surface the bank name when we have it. "Wealthsimple is
//     slow" reads as a specific fact; "your bank is slow" reads as
//     an excuse.

type Props = {
  bankName?: string | null;
  estimatedWaitMinutes?: number;
  onContinue: () => void;
};

export function WaitingForBankCard({
  bankName,
  estimatedWaitMinutes,
  onContinue,
}: Props) {
  const subject = bankName?.trim() ? bankName : "Your bank";
  const eta =
    estimatedWaitMinutes && estimatedWaitMinutes > 0
      ? estimatedWaitMinutes
      : 15;

  return (
    <div className="rounded-3xl bg-white border border-hairline/60 p-8 max-w-[540px] mx-auto">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">
        <Clock size={20} />
      </div>

      <h2 className="mt-5 font-display text-[24px] md:text-[26px] font-bold tracking-[-0.02em] text-ink leading-tight">
        {subject} is still releasing your history
      </h2>

      <p className="mt-3 text-[15px] leading-relaxed text-ink-body">
        Some banks queue the first transaction pull on their side. We&apos;ve
        connected successfully and Plaid is fetching now — typically{" "}
        <span className="tnum">{eta}</span> minutes, sometimes longer for
        first connections.
      </p>

      <div className="mt-5 rounded-2xl bg-ink/[0.03] border border-hairline/60 p-4 space-y-2.5 text-[13.5px] text-ink-body leading-relaxed">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand text-[11px] font-semibold">
            1
          </span>
          <span>
            We&apos;re watching for the data in the background, even if you
            close this tab.
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand text-[11px] font-semibold">
            2
          </span>
          <span>
            The moment your bank delivers, we&apos;ll scan automatically and
            your dashboard will populate.
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand text-[11px] font-semibold">
            3
          </span>
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            <Mail size={12} className="text-ink-muted" />
            We&apos;ll email you when your first scan is ready.
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onContinue}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-white hover:bg-ink/85 transition"
        >
          Go to dashboard
        </button>
        <a
          href="/learn"
          className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-ink hover:bg-ink/[0.04] transition"
        >
          How this works
        </a>
      </div>

      <div className="mt-5 inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
        <ShieldCheck size={11} className="text-brand" />
        Read-only access · No card numbers stored · via Plaid
      </div>
    </div>
  );
}
