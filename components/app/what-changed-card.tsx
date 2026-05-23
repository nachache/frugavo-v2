"use client";

// "What changed this month" — retention loop card on the dashboard.
//
// Reads /api/dashboard/changes (built earlier — diffs the two most
// recent scan snapshots) and renders a tight summary the user sees
// every time they come back: what's new, what's gone, what moved.
//
// Empty state path: when the user has only one completed scan, the
// endpoint returns status=needs_more_scans. We hide the entire card
// in that case so a brand-new account isn't staring at an empty
// component.
//
// Visual structure:
//   • Header: net monthly delta (the emotional anchor — "+$24/mo" or
//     "-$18/mo" with up/down icon)
//   • Four rows of changes, each with severity dot, icon, label,
//     and amount/delta — collapsed when empty
//   • Tap a row → navigate to that subscription's detail page

import { useEffect, useState } from "react";
import Link from "next/link";

type ChangeRow = {
  plaid_stream_id: string;
  merchant_name: string;
  category: string;
  monthly_equivalent_cents: number;
};

type PriceChange = ChangeRow & {
  amount_from_cents: number;
  amount_to_cents: number;
  delta_cents: number;
  delta_pct: number;
};

type ChangesPayload = {
  ok: boolean;
  status?: "ok" | "needs_more_scans";
  current?: { scan_run_id: string; as_of_date: string; monthly_total_cents: number; subscription_count: number };
  prior?: { scan_run_id: string; as_of_date: string; monthly_total_cents: number; subscription_count: number };
  net_monthly_delta_cents?: number;
  new_subscriptions?: ChangeRow[];
  removed_subscriptions?: ChangeRow[];
  price_increases?: PriceChange[];
  price_decreases?: PriceChange[];
};

function fmt(c: number, signed = false): string {
  const abs = Math.abs(c) / 100;
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  if (!signed) return `$${formatted}`;
  return `${c >= 0 ? "+" : "-"}$${formatted}`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function WhatChangedCard() {
  const [data, setData] = useState<ChangesPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/changes")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setData({ ok: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide entirely until we have a real diff to show.
  if (!data) return null;
  if (!data.ok) return null;
  if (data.status === "needs_more_scans") return null;

  const newSubs = data.new_subscriptions ?? [];
  const removedSubs = data.removed_subscriptions ?? [];
  const priceUp = data.price_increases ?? [];
  const priceDown = data.price_decreases ?? [];
  const totalChanges =
    newSubs.length + removedSubs.length + priceUp.length + priceDown.length;
  if (totalChanges === 0) return null;

  const delta = data.net_monthly_delta_cents ?? 0;
  const trendingUp = delta > 0;

  return (
    <div
      className="rounded-2xl border border-hairline bg-surface p-4 md:p-7 animate-fadeUp"
      style={{ animationDelay: "0.05s" }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            What changed
          </div>
          <div className="mt-1 text-[13px] md:text-[14px] text-ink-body">
            Since {fmtDate(data.prior?.as_of_date)} ·{" "}
            {totalChanges} {totalChanges === 1 ? "change" : "changes"}
          </div>
        </div>
        <div className="text-right">
          <div
            className={[
              "font-display font-bold text-[28px] md:text-[36px] tracking-[-0.02em] tabular-nums leading-none",
              delta === 0
                ? "text-ink-muted"
                : trendingUp
                  ? "text-danger"
                  : "text-brand",
            ].join(" ")}
          >
            {delta === 0 ? "no change" : fmt(delta, true)}
          </div>
          <div className="mt-1 text-[11px] md:text-[12px] text-ink-muted">
            monthly burn vs last scan
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {newSubs.map((s) => (
          <ChangeRowItem
            key={`new-${s.plaid_stream_id}`}
            type="new"
            merchant={s.merchant_name}
            category={s.category}
            amountCents={s.monthly_equivalent_cents}
            streamId={s.plaid_stream_id}
          />
        ))}
        {priceUp.map((p) => (
          <ChangeRowItem
            key={`up-${p.plaid_stream_id}`}
            type="price_up"
            merchant={p.merchant_name}
            category={p.category}
            amountCents={p.amount_to_cents}
            deltaPct={p.delta_pct}
            streamId={p.plaid_stream_id}
          />
        ))}
        {priceDown.map((p) => (
          <ChangeRowItem
            key={`down-${p.plaid_stream_id}`}
            type="price_down"
            merchant={p.merchant_name}
            category={p.category}
            amountCents={p.amount_to_cents}
            deltaPct={p.delta_pct}
            streamId={p.plaid_stream_id}
          />
        ))}
        {removedSubs.map((s) => (
          <ChangeRowItem
            key={`gone-${s.plaid_stream_id}`}
            type="removed"
            merchant={s.merchant_name}
            category={s.category}
            amountCents={s.monthly_equivalent_cents}
            streamId={s.plaid_stream_id}
          />
        ))}
      </div>
    </div>
  );
}

function ChangeRowItem({
  type,
  merchant,
  category,
  amountCents,
  deltaPct,
  streamId,
}: {
  type: "new" | "removed" | "price_up" | "price_down";
  merchant: string;
  category: string;
  amountCents: number;
  deltaPct?: number;
  streamId: string;
}) {
  const cfg = {
    new: {
      dot: "bg-brand",
      icon: <PlusIcon />,
      label: "New subscription",
    },
    removed: {
      dot: "bg-ink-muted",
      icon: <MinusIcon />,
      label: "Removed",
    },
    price_up: {
      dot: "bg-danger",
      icon: <ArrowUpIcon />,
      label: "Price up",
    },
    price_down: {
      dot: "bg-brand",
      icon: <ArrowDownIcon />,
      label: "Price down",
    },
  }[type];

  const amountColor =
    type === "removed"
      ? "text-ink-muted line-through"
      : type === "price_up"
        ? "text-danger"
        : type === "price_down"
          ? "text-brand"
          : "text-ink";

  return (
    <Link
      href={`/app/subscriptions/${streamId}`}
      className="flex items-center gap-3 rounded-xl bg-canvas/40 px-3 py-3 md:px-4 md:py-3.5 hover:bg-canvas/70 transition group"
    >
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${cfg.dot} text-canvas`}
      >
        {cfg.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] md:text-[15px] font-medium text-ink truncate group-hover:underline decoration-ink/30 underline-offset-2">
          {merchant}
        </div>
        <div className="text-[12px] md:text-[13px] text-ink-muted">
          {cfg.label} · {prettyCategory(category)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[14px] md:text-[15px] font-medium tabular-nums ${amountColor}`}>
          {fmt(amountCents)}/mo
        </div>
        {deltaPct !== undefined && (
          <div
            className={`text-[11px] md:text-[12px] font-medium tabular-nums ${type === "price_up" ? "text-danger" : "text-brand"}`}
          >
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct.toFixed(1)}%
          </div>
        )}
      </div>
    </Link>
  );
}

function prettyCategory(cat: string): string {
  const map: Record<string, string> = {
    streaming: "Streaming",
    software: "Software",
    news: "News",
    fitness: "Fitness",
    food_delivery: "Food delivery",
    cloud_storage: "Cloud storage",
    gaming: "Gaming",
    telecom: "Phone & internet",
    phone_internet: "Phone & internet",
    utilities: "Utilities",
    education: "Education",
    insurance: "Insurance",
    other: "Other",
    bank_fees: "Bank fees",
  };
  return map[cat] ?? cat.replace(/_/g, " ");
}

// ───────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}
