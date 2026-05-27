"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ShieldCheck } from "lucide-react";

// NeedsReauthScreen — terminal state when Plaid returns
// ITEM_LOGIN_REQUIRED / INVALID_CREDENTIALS / USER_PERMISSION_REVOKED.
//
// Distinct from PreparingScreen because polling won't help — the user
// must click "Re-link" and complete Plaid Link again before any
// ingestion can resume. We still poll in the background so the
// dashboard appears immediately after the user finishes re-linking
// in a new tab.

type Props = {
  bankNames: string;
};

const POLL_INTERVAL_MS = 4_000;

export function NeedsReauthScreen({ bankNames }: Props) {
  const router = useRouter();
  const bank = bankNames.trim() || "your bank";

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  return (
    <section className="container-page py-10 md:py-16 max-w-[720px]">
      <div className="mb-6 md:mb-8">
        <span className="text-[12px] md:text-[13px] font-medium text-danger">
          Connection needs attention
        </span>
        <h1 className="mt-1.5 md:mt-2 font-display text-[28px] sm:text-[34px] md:text-[42px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
          {bank} needs you to re-authorize.
        </h1>
        <p className="mt-2 md:mt-3 text-[14px] md:text-[15.5px] leading-relaxed text-ink-body">
          Your bank temporarily ended the secure session — this happens
          every 90 days, after a password change, or when your bank pushes
          a new login step. Re-link to resume syncing.
        </p>
      </div>

      <div className="rounded-3xl bg-white border border-hairline/60 p-6 md:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <AlertCircle size={20} />
        </div>
        <h2 className="mt-4 font-display text-[20px] md:text-[22px] font-bold tracking-[-0.02em] text-ink">
          Re-link to keep your dashboard accurate
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-body">
          Until you re-link, your numbers will be frozen at the last
          successful sync. New charges won&apos;t appear and renewals
          won&apos;t alert.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="/app/connect"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-white hover:bg-ink/85 transition"
          >
            Re-link {bank}
          </a>
          <a
            href="/app/settings"
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-ink hover:bg-ink/[0.04] transition"
          >
            Manage connections
          </a>
        </div>
      </div>

      <div className="mt-6 inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
        <ShieldCheck size={11} className="text-brand" />
        Read-only access · No card numbers stored · via Plaid
      </div>
    </section>
  );
}
