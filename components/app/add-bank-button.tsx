"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectBankButton } from "@/components/plaid/connect-bank-button";

// Settings-page wrapper around the existing ConnectBankButton.
//
// Paid users see the live Plaid Link flow — same code path as the
// first-connect entry on /app/connect. After success the page
// router.refresh()es so the new bank appears in the Connected
// banks list immediately.
//
// Free users see a "Pro feature" prompt. Clicking it routes to the
// upgrade flow rather than burning a Plaid Link session that we'd
// then have to gate downstream.

type Props = {
  isPaid: boolean;
};

export function AddBankButton({ isPaid }: Props) {
  const router = useRouter();
  const [isUpgrading, setIsUpgrading] = useState(false);

  async function upgrade() {
    if (isUpgrading) return;
    setIsUpgrading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      router.push("/app/protection");
    } catch {
      router.push("/app/protection");
    } finally {
      setIsUpgrading(false);
    }
  }

  if (!isPaid) {
    return (
      <div className="mt-4 rounded-xl border border-hairline/60 bg-canvas/40 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-brand">
                Pro feature
              </span>
            </div>
            <p className="mt-1.5 text-[13.5px] text-ink-body leading-relaxed">
              Connecting more than one bank or card is part of Protection.
              You can confirm here and add another account in seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={upgrade}
            disabled={isUpgrading}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-canvas hover:bg-ink/85 transition disabled:opacity-60 whitespace-nowrap"
          >
            {isUpgrading ? "Opening…" : "Activate to add"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 pt-4 border-t border-hairline/60">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-ink">
            Add another bank or card
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-muted leading-snug">
            Connecting your credit card issuer alongside your bank
            usually surfaces 2–3 subscriptions Frugavo can&apos;t see
            from one account alone.
          </p>
        </div>
        <ConnectBankButton
          variant="compact"
          compactLabel="Connect another account"
        />
      </div>
    </div>
  );
}
