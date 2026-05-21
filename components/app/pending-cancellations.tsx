"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, RefreshCw } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { formatCurrency } from "@/lib/utils";
import { annualCents } from "@/lib/subscription-math";
import type { Subscription } from "./subscription-list";

// Pending watcher cancellations. Two layouts:
//   - default (full-width below the main list): kept for callers that
//     want the wide treatment
//   - compact: side-rail card with stacked small rows + "Check now"
//     button. Used by the dashboard's right column.

type Props = {
  pending: Subscription[];
  compact?: boolean;
};

export function PendingCancellations({ pending, compact }: Props) {
  const router = useRouter();
  const [running, startRun] = useTransition();
  const [last, setLast] = useState<null | {
    confirmed: number;
    failed: number;
    stillPending: number;
  }>(null);

  if (pending.length === 0 && !compact) return null;

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

  // Compact (side-rail) treatment.
  if (compact) {
    return (
      <aside className="rounded-3xl border border-hairline/60 bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11.5px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
            Watching · {pending.length}
          </div>
          {pending.length > 0 && (
            <button
              onClick={runWatcher}
              disabled={running}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-hairline bg-white px-2.5 text-[11px] font-medium text-ink hover:bg-ink/[0.04] transition disabled:opacity-50"
            >
              {running ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <RefreshCw size={11} />
              )}
              Check
            </button>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-ink-muted leading-relaxed">
            Nothing to watch yet. When you cancel a subscription, we&apos;ll
            verify the next bill stops here.
          </p>
        ) : (
          <>
            {last && <ResultLine last={last} />}
            <ul className="mt-3 space-y-2">
              {pending.map((s) => (
                <CompactRow key={s.id} sub={s} />
              ))}
            </ul>
          </>
        )}
      </aside>
    );
  }

  // Full-width treatment.
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
      {last && <ResultLine last={last} />}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pending.map((s) => (
          <FullRow key={s.id} sub={s} />
        ))}
      </ul>
    </section>
  );
}

function ResultLine({
  last,
}: {
  last: { confirmed: number; failed: number; stillPending: number };
}) {
  return (
    <p className="mt-2 text-[12.5px] text-ink-muted leading-relaxed">
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
  );
}

function CompactRow({ sub }: { sub: Subscription }) {
  const annual = annualCents(sub.amount_cents, sub.frequency);
  return (
    <li className="rounded-xl bg-brand-light/30 border border-brand/20 p-3 flex items-center gap-3">
      <BrandLogo
        merchant={sub.merchant_name}
        category={sub.category}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink truncate">
          {sub.merchant_name}
        </div>
        <div className="inline-flex items-center gap-1 text-[11px] text-emerald-900/75 font-medium">
          <Clock size={10} />
          {formatCurrency(annual / 100, false)}/yr if it sticks
        </div>
      </div>
    </li>
  );
}

function FullRow({ sub }: { sub: Subscription }) {
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
          {expected
            ? `Next bill expected ${expected.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}`
            : "Next bill date unknown"}
        </div>
      </div>
    </li>
  );
}
