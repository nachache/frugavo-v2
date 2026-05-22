"use client";

// ActionCenter — three tabs that consolidate every "what should I do
// with this?" surface on the dashboard:
//
//   Worth a look   subscriptions the user hasn't decided on yet
//   Watching       subscriptions the user actively kept
//   Pruned         subscriptions the user cancelled
//
// Header surfaces "Up to $X/yr in potential savings" — the sum of
// yearly equivalents in Worth a look. Promotes the action from a
// callout to the section identity.

import { useState } from "react";
import Link from "next/link";
import type { ActionItem } from "@/lib/selectors/dashboard";

type Props = {
  worth_a_look: ActionItem[];
  watching: ActionItem[];
  pruned: ActionItem[];
  potential_yearly_savings_cents: number;
};

type Tab = "worth" | "watching" | "pruned";

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
  const [tab, setTab] = useState<Tab>("worth");
  const totalActions =
    worth_a_look.length + watching.length + pruned.length;
  if (totalActions === 0) return null;

  const list =
    tab === "worth"
      ? worth_a_look
      : tab === "watching"
        ? watching
        : pruned;

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-display text-[18px] md:text-[22px] font-bold tracking-[-0.01em] text-ink leading-tight">
          Action center
        </h2>
        {potential_yearly_savings_cents > 0 && (
          <div className="text-right">
            <div className="text-[20px] md:text-[28px] font-display font-bold tabular-nums text-ink leading-none">
              up to {fmt(potential_yearly_savings_cents, { withCents: false })}/yr
            </div>
            <div className="mt-1 text-[11px] md:text-[12px] text-ink-muted">
              in potential savings
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-4 flex items-center gap-1 border-b border-hairline">
        <TabButton
          active={tab === "worth"}
          onClick={() => setTab("worth")}
          label="Worth a look"
          count={worth_a_look.length}
        />
        <TabButton
          active={tab === "watching"}
          onClick={() => setTab("watching")}
          label="Watching"
          count={watching.length}
        />
        <TabButton
          active={tab === "pruned"}
          onClick={() => setTab("pruned")}
          label="Pruned"
          count={pruned.length}
        />
      </div>

      <div className="mt-4">
        {list.length === 0 ? (
          <EmptyTab tab={tab} />
        ) : (
          <div className="space-y-2">
            {list.slice(0, 15).map((item) => (
              <ActionRow key={item.subscription_id} item={item} tab={tab} />
            ))}
            {list.length > 15 && (
              <div className="pt-2 text-[12px] text-ink-muted text-center">
                + {list.length - 15} more — continue in the list below
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
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
        "relative h-10 px-3 md:px-4 -mb-px border-b-2 inline-flex items-center gap-2 text-[13px] md:text-[14px] font-medium transition",
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

function ActionRow({ item, tab }: { item: ActionItem; tab: Tab }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-canvas/40 px-3 py-3 md:px-4 md:py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] md:text-[15px] font-medium text-ink truncate">
          {item.merchant_name}
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
      <div className="text-right shrink-0">
        <div className="text-[14px] md:text-[15px] font-medium text-ink tabular-nums">
          {fmt(item.monthly_cents)}/mo
        </div>
        <div className="text-[11px] text-ink-muted tabular-nums">
          {fmt(item.yearly_cents, { withCents: false })}/yr
        </div>
      </div>
      <Link
        href={`/app/subscriptions/${item.subscription_id}`}
        className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink text-[12px] font-medium transition"
      >
        {tab === "worth" ? "Review" : "Open"}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </div>
  );
}

function EmptyTab({ tab }: { tab: Tab }) {
  const msg =
    tab === "worth"
      ? "Nothing to review right now — your detected subscriptions all have a decision."
      : tab === "watching"
        ? "Subscriptions you keep will show up here once you mark them."
        : "Subscriptions you cancel will show up here so you can confirm the next bill doesn't land.";
  return (
    <div className="py-6 text-center text-[13px] text-ink-muted">{msg}</div>
  );
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
