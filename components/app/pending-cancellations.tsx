"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, RefreshCw } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { formatCurrency } from "@/lib/utils";
import {
  annualCents,
  monthlyEquivalentCents,
} from "@/lib/subscription-math";
import type { Subscription } from "./subscription-list";

// Subscriptions where the user has tapped "I cancelled it" but the
// next-bill watcher hasn't confirmed yet. Lives between the active
// list and the Pruned section so the user can see "we're watching."

type Props = {
  pending: Subscription[];
};

export function PendingCancellations({ pending }: Props) {
  const router = useRouter();
  const [running, startRun] = useTransition();
  const [last, setLast] = useState<null | {
    confirmed: number;
    failed: number;
    stillPending: number;
  }>(null);

  if (pending.length === 0) return null;

  const runWatcher = () => {
    startRun(async () => {
      const res = await fetch("/api/cancellations/watch", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as {
          confirmed: number;
          failed: number;
          stillPending: number;
        };
        setLast({
          confirmed: data.confirmed,
          failed: data.failed,
          stillPending: data.stillPending,
        });
        router.refresh();
      }
    });
  };

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
          Watching the next bill · {pending.length}
        </h2>
        <button
          onClick={runWatcher}
          disabled={running}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-hairline bg-white px-3 text-[12px] font-medium text-ink hover:bg-ink/[0.04] transition disabled:opacity-50"
        >
          {running ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          Check now
        </button>
      </div>

      {last && (
        <p className="mt-2 text-[12.5px] text-ink-muted">
          {last.confirmed > 0 && (
            <>
              <span className="text-brand font-medium">
                {last.confirmed} confirmed cancelled.
              </span>{" "}
            </>
          )}
          {last.failed > 0 && (
            <>
              <span className="text-danger font-medium">
                {last.failed} still being charged.
              </span>{" "}
            </>
          )}
          {last.stillPending > 0 && (
            <>{last.stillPending} not due yet — we&apos;ll keep watching.</>
          )}
        </p>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pending.map((s) => (
          <PendingRow key={s.id} sub={s} />
        ))}
      </ul>
    </section>
  );
}

function PendingRow({ sub }: { sub: Subscription }) {
  const monthly = monthlyEquivalentCents(sub.amount_cents, sub.frequency);
  const annual = annualCents(sub.amount_cents, sub.frequency);
  const expected = sub.next_expected_charge_at
    ? new Date(sub.next_expected_charge_at)
    : null;

  return (
    <li className="rounded-2xl bg-brand-light/30 border border-brand/30 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <BrandLogo
          merchant={sub.merchant_name}
          category={sub.category}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-ink truncate">
            {sub.merchant_name}
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-emerald-900/75 font-medium">
            <Clock size={11} />
            Watching next bill
          </div>
        </div>
      </div>

      <div className="tnum">
        <div className="text-[13px] text-ink-body">
          Saving{" "}
          <span className="font-display font-semibold text-ink">
            {formatCurrency(annual / 100, false)}/yr
          </span>{" "}
          if it sticks
        </div>
        <div className="text-[11.5px] text-ink-muted mt-0.5">
          {formatCurrency(monthly / 100)}/mo ·{" "}
          {expected
            ? `next bill expected ${expected.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}`
            : "next bill date unknown"}
        </div>
      </div>
    </li>
  );
}
