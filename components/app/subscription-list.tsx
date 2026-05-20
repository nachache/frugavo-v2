"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, RefreshCw, Loader2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// Subscription row shape — matches the shape returned by the /app
// server component query.
export type Subscription = {
  id: string;
  merchant_name: string;
  amount_cents: number;
  currency: string;
  frequency: string;
  last_charged_at: string | null;
  next_expected_charge_at: string | null;
  status: "active" | "cancelled" | "paused" | "uncertain";
  user_decision: "keep" | "cancel" | "unsure" | null;
};

function dollars(cents: number): number {
  return cents / 100;
}

function totalMonthly(subs: Subscription[]): number {
  return subs.reduce((sum, s) => {
    if (s.status !== "active") return sum;
    const monthly =
      s.frequency === "monthly"
        ? dollars(s.amount_cents)
        : s.frequency === "annually"
        ? dollars(s.amount_cents) / 12
        : s.frequency === "weekly"
        ? dollars(s.amount_cents) * 52 / 12
        : s.frequency === "biweekly"
        ? dollars(s.amount_cents) * 26 / 12
        : s.frequency === "semi_monthly"
        ? dollars(s.amount_cents) * 2
        : 0;
    return sum + monthly;
  }, 0);
}

export function SubscriptionList({
  initial,
}: {
  initial: Subscription[];
}) {
  const router = useRouter();
  const [items] = useState(initial);
  const [rescanning, startRescan] = useTransition();

  const active = items.filter((s) => s.status === "active");
  const cancelled = items.filter((s) => s.status === "cancelled");
  const monthly = totalMonthly(items);
  const annual = monthly * 12;

  const triggerRescan = () => {
    startRescan(async () => {
      await fetch("/api/plaid/scan", { method: "POST" });
      router.refresh();
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-3xl bg-white border border-hairline/60 p-8 text-center">
        <p className="text-[15px] text-ink-body">
          No recurring charges detected yet. Plaid sandbox accounts sometimes
          take a few minutes to populate. Try a re-scan.
        </p>
        <button
          onClick={triggerRescan}
          disabled={rescanning}
          className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-[13px] font-medium text-white hover:bg-ink/85 transition disabled:opacity-50"
        >
          {rescanning ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <RefreshCw size={14} />
              Re-scan
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Totals card */}
      <div className="rounded-3xl bg-brand-light p-6 flex items-center justify-between gap-6">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-emerald-900/70 font-semibold">
            Active monthly cost
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[40px] md:text-[48px] leading-none font-display font-bold tracking-[-0.03em] text-brand tnum">
              {formatCurrency(monthly)}
            </span>
            <span className="text-[14px] font-medium text-emerald-900/70">
              /mo
            </span>
          </div>
          <div className="mt-1 text-[13px] text-emerald-900/70 tnum">
            ≈ {formatCurrency(annual, false)}/yr · {active.length} active{" "}
            {active.length === 1 ? "subscription" : "subscriptions"}
          </div>
        </div>
        <button
          onClick={triggerRescan}
          disabled={rescanning}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-medium text-ink hover:bg-ink/[0.04] border border-hairline transition disabled:opacity-50"
        >
          {rescanning ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <RefreshCw size={14} />
              Re-scan
            </>
          )}
        </button>
      </div>

      {/* Active subscriptions */}
      <section className="mt-10">
        <h2 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
          Active · {active.length}
        </h2>
        <ul className="mt-4 grid gap-3">
          {active.map((s) => (
            <SubscriptionRow key={s.id} sub={s} />
          ))}
        </ul>
      </section>

      {cancelled.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
            Already cancelled · {cancelled.length}
          </h2>
          <ul className="mt-4 grid gap-3">
            {cancelled.map((s) => (
              <SubscriptionRow key={s.id} sub={s} cancelled />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SubscriptionRow({
  sub,
  cancelled,
}: {
  sub: Subscription;
  cancelled?: boolean;
}) {
  const monthlyEquivalent =
    sub.frequency === "monthly"
      ? dollars(sub.amount_cents)
      : sub.frequency === "annually"
      ? dollars(sub.amount_cents) / 12
      : sub.frequency === "weekly"
      ? (dollars(sub.amount_cents) * 52) / 12
      : sub.frequency === "biweekly"
      ? (dollars(sub.amount_cents) * 26) / 12
      : dollars(sub.amount_cents);

  return (
    <li
      className={cn(
        "rounded-2xl bg-white border border-hairline/60 p-4 flex items-center gap-4",
        cancelled && "opacity-60"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink/[0.06] text-[14px] font-semibold text-ink uppercase">
        {sub.merchant_name.charAt(0)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-medium text-ink truncate">
          {sub.merchant_name}
        </div>
        <div className="text-[12px] text-ink-muted tnum">
          {sub.frequency.replace("_", " ")} ·{" "}
          {sub.last_charged_at
            ? `last charged ${new Date(sub.last_charged_at).toLocaleDateString()}`
            : "billing date unknown"}
        </div>
      </div>

      <div className="text-right tnum">
        <div className="text-[16px] font-display font-semibold text-ink">
          {formatCurrency(dollars(sub.amount_cents))}
        </div>
        <div className="text-[11.5px] text-ink-muted">
          {sub.frequency === "monthly"
            ? "/mo"
            : `≈ ${formatCurrency(monthlyEquivalent)}/mo`}
        </div>
      </div>

      {!cancelled ? (
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <button
            disabled
            title="Cancel-assist ships in week 5"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-white px-3 text-[12.5px] font-medium text-ink hover:border-accent hover:bg-accent hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={12} />
            Cancel
          </button>
          <button
            disabled
            className="inline-flex h-9 items-center justify-center rounded-full border border-hairline bg-white px-3 text-[12.5px] font-medium text-ink hover:bg-ink/[0.04] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={12} />
            Keep
          </button>
        </div>
      ) : (
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-brand-light px-3 h-8 text-[11.5px] font-medium text-brand">
          <Check size={11} strokeWidth={3} />
          Cancelled
        </span>
      )}
    </li>
  );
}
