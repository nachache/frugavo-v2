"use client";

// ActionCenter — the ONLY subscription list on the dashboard.
//
// Four tabs:
//   Worth a look   no decision yet
//   Watching       user kept
//   Pruned         user cancelled
//   All            every confirmed subscription
//
// Sort control (Most expensive / Oldest / Category) lives on the
// right side of the tab strip. Logos (Clearbit + fallback) render
// next to every name. Inline tag pills show "Biggest line item" or
// "Might be forgotten" when the selector flags them.
//
// Pagination: 20 rows visible; "Load more" reveals the next 20.

import { useMemo, useState } from "react";
import Link from "next/link";
import { MerchantLogo } from "./merchant-logo";
import type { ActionItem } from "@/lib/selectors/dashboard";

type Tab = "worth" | "watching" | "pruned" | "all";
type Sort = "price" | "age" | "category";
const PAGE_SIZE = 20;

type Props = {
  worth_a_look: ActionItem[];
  watching: ActionItem[];
  pruned: ActionItem[];
  potential_yearly_savings_cents: number;
};

function fmt(c: number, opts: { withCents?: boolean } = {}): string {
  const v = c / 100;
  if (opts.withCents === false) return `$${Math.round(v).toLocaleString("en-US")}`;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ActionCenter({
  worth_a_look,
  watching,
  pruned,
  potential_yearly_savings_cents,
}: Props) {
  const all = useMemo(
    () => [...worth_a_look, ...watching, ...pruned],
    [worth_a_look, watching, pruned]
  );

  const [tab, setTab] = useState<Tab>("worth");
  const [sort, setSort] = useState<Sort>("price");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (all.length === 0) return null;

  const tabList =
    tab === "worth"
      ? worth_a_look
      : tab === "watching"
        ? watching
        : tab === "pruned"
          ? pruned
          : all;

  const sorted = useMemo(() => {
    const arr = [...tabList];
    if (sort === "price") {
      arr.sort((a, b) => b.monthly_cents - a.monthly_cents);
    } else if (sort === "age") {
      arr.sort((a, b) => {
        const ax = a.last_charged_at ? new Date(a.last_charged_at).getTime() : 0;
        const bx = b.last_charged_at ? new Date(b.last_charged_at).getTime() : 0;
        return ax - bx;
      });
    } else if (sort === "category") {
      arr.sort((a, b) =>
        a.category.localeCompare(b.category) ||
        b.monthly_cents - a.monthly_cents
      );
    }
    return arr;
  }, [tabList, sort]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visible.length;

  function changeTab(t: Tab) {
    setTab(t);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-display text-[20px] md:text-[24px] font-bold tracking-[-0.01em] text-ink leading-tight">
          Your subscriptions
        </h2>
        {potential_yearly_savings_cents > 0 && worth_a_look.length > 0 && (
          <div className="text-right">
            <div className="text-[18px] md:text-[22px] font-display font-bold tabular-nums text-ink leading-none">
              up to {fmt(potential_yearly_savings_cents, { withCents: false })}/yr
            </div>
            <div className="mt-1 text-[11px] md:text-[12px] text-ink-muted">
              in potential savings
            </div>
          </div>
        )}
      </div>

      {/* Tab strip + sort */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-hairline">
        <div className="flex items-center gap-1 -mb-px overflow-x-auto">
          <TabBtn active={tab === "worth"} onClick={() => changeTab("worth")} label="Worth a look" count={worth_a_look.length} />
          <TabBtn active={tab === "watching"} onClick={() => changeTab("watching")} label="Watching" count={watching.length} />
          <TabBtn active={tab === "pruned"} onClick={() => changeTab("pruned")} label="Pruned" count={pruned.length} />
          <TabBtn active={tab === "all"} onClick={() => changeTab("all")} label="All" count={all.length} />
        </div>
        <SortControl value={sort} onChange={setSort} />
      </div>

      {/* List */}
      <div className="mt-4">
        {sorted.length === 0 ? (
          <EmptyTab tab={tab} />
        ) : (
          <div className="divide-y divide-hairline">
            {visible.map((item) => (
              <Row key={item.subscription_id} item={item} />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink px-4 text-[13px] font-medium transition"
            >
              Load {Math.min(PAGE_SIZE, sorted.length - visible.length)} more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab button ────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative h-10 px-3 md:px-4 border-b-2 inline-flex items-center gap-2 text-[13px] md:text-[14px] font-medium transition whitespace-nowrap",
        active
          ? "border-ink text-ink"
          : "border-transparent text-ink-muted hover:text-ink",
      ].join(" ")}
    >
      {label}
      <span
        className={[
          "inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-[11px] tabular-nums",
          active ? "bg-ink text-canvas" : "bg-ink/5 text-ink-muted",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

// ─── Sort control ──────────────────────────────────────────────────

function SortControl({
  value,
  onChange,
}: {
  value: Sort;
  onChange: (v: Sort) => void;
}) {
  const opts: { value: Sort; label: string }[] = [
    { value: "price", label: "Most expensive" },
    { value: "age", label: "Oldest charge" },
    { value: "category", label: "Category" },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink/[0.04] text-[12px] mb-2">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={[
            "h-7 px-3 rounded-full transition",
            value === o.value
              ? "bg-surface text-ink shadow-soft font-medium"
              : "text-ink-muted hover:text-ink",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────────

function Row({ item }: { item: ActionItem }) {
  return (
    <Link
      href={`/app/subscriptions/${item.subscription_id}`}
      className="flex items-center gap-3 md:gap-4 py-3 md:py-4 -mx-2 px-2 rounded-lg hover:bg-ink/[0.03] transition group"
    >
      <MerchantLogo name={item.merchant_name} domain={item.domain} size={32} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[14px] md:text-[15px] font-medium text-ink truncate group-hover:underline decoration-ink/30 underline-offset-2">
            {item.merchant_name}
          </span>
          {item.tags.map((t) => (
            <Tag key={t} kind={t === "Biggest line item" ? "primary" : "subtle"}>
              {t}
            </Tag>
          ))}
        </div>
        <div className="mt-0.5 text-[11px] md:text-[12px] text-ink-muted">
          {item.reason ?? prettyCategory(item.category)}
          {item.last_charged_at && (
            <>
              {" · last "}
              {new Date(item.last_charged_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="text-[14px] md:text-[15px] font-medium text-ink tabular-nums">
            {fmt(item.monthly_cents)}/mo
          </div>
          <div className="text-[11px] text-ink-muted tabular-nums">
            {fmt(item.yearly_cents, { withCents: false })}/yr
          </div>
        </div>
        <span className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-hairline bg-surface group-hover:bg-ink/[0.04] text-ink text-[12px] font-medium transition">
          Review
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function Tag({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: "primary" | "subtle";
}) {
  const cls =
    kind === "primary"
      ? "bg-brand/10 text-brand border-brand/20"
      : "bg-accent/10 text-accent border-accent/20";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 h-5 text-[10px] md:text-[11px] font-medium leading-none ${cls}`}
    >
      {children}
    </span>
  );
}

function EmptyTab({ tab }: { tab: Tab }) {
  const msg =
    tab === "worth"
      ? "Nothing to review — everything in your list has a decision."
      : tab === "watching"
        ? "Subscriptions you keep will appear here once you mark them."
        : tab === "pruned"
          ? "Subscriptions you cancel will appear here so you can watch the next bill."
          : "No subscriptions detected yet. Re-scan after Plaid syncs more transactions.";
  return <div className="py-8 text-center text-[13px] text-ink-muted">{msg}</div>;
}

function prettyCategory(cat: string): string {
  const map: Record<string, string> = {
    streaming: "Streaming",
    software: "Software",
    news: "News & reading",
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
