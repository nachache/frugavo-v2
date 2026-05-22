"use client";

// ActionCenter — the ONLY subscription list on the dashboard.
//
// Tabs:
//   Worth a look   no decision yet
//   Watching       user kept / confirmed
//   Pruned         user cancelled
//   Hidden         user marked as not a subscription (greyed out)
//   All            every confirmed subscription
//
// Per-row actions:
//   Cancel  → opens CancelModal with deep links + email template,
//             POSTs /api/feedback (override_type=cancelled),
//             POSTs /api/cancellations for analytics,
//             triggers CancelCelebration.
//   Keep    → POSTs /api/feedback (override_type=confirmed), no modal.
//   Review  → opens /app/subscriptions/{id}.
//
// Cancel/Keep buttons are hover-revealed (focus-within accessible).

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { MerchantLogo } from "./merchant-logo";
import { CancelModal } from "./cancel-modal";
import { CancelCelebration } from "./cancel-celebration";
import { annualCents, monthlyEquivalentCents, type SubLike } from "@/lib/subscription-math";
import type { ActionItem } from "@/lib/selectors/dashboard";

type Tab = "worth" | "watching" | "pruned" | "hidden" | "all";
type Sort = "price" | "age" | "category";
const PAGE_SIZE = 20;

type Props = {
  worth_a_look: ActionItem[];
  watching: ActionItem[];
  pruned: ActionItem[];
  hidden: ActionItem[];
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

// ActionItem → SubLike adapter for the existing CancelModal.
function toSubLike(item: ActionItem): SubLike {
  return {
    id: item.subscription_id,
    merchant_name: item.merchant_name,
    normalized_name: item.merchant_name,
    category: item.category,
    amount_cents: item.amount_cents,
    currency: item.currency,
    frequency: item.frequency,
    last_charged_at: item.last_charged_at,
    next_expected_charge_at: item.next_expected_charge_at,
    status: item.status,
    user_decision: null,
    classification: item.classification ?? "confirmed",
  };
}

export function ActionCenter({
  worth_a_look,
  watching,
  pruned,
  hidden,
  potential_yearly_savings_cents,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("worth");
  const [sort, setSort] = useState<Sort>("price");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [cancelTarget, setCancelTarget] = useState<SubLike | null>(null);
  const [celebrate, setCelebrate] = useState<{
    annualSaved: number;
    merchant: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  // ─── Preference persistence ─────────────────────────────────────
  // Load saved tab + sort on mount. Save (debounced) when either
  // changes. `prefsHydrated` blocks the save effect from firing
  // before the fetch returns — otherwise we'd overwrite the saved
  // value with the initial defaults.
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const p = (j?.prefs ?? {}) as {
          action_center_tab?: Tab;
          action_center_sort?: Sort;
        };
        if (p.action_center_tab) setTab(p.action_center_tab);
        if (p.action_center_sort) setSort(p.action_center_sort);
      })
      .catch(() => {
        // ignore — defaults are fine
      })
      .finally(() => {
        if (!cancelled) setPrefsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_center_tab: tab,
          action_center_sort: sort,
        }),
      }).catch(() => {
        // best-effort
      });
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [tab, sort, prefsHydrated]);

  const all = useMemo(
    () => [...worth_a_look, ...watching, ...pruned, ...hidden],
    [worth_a_look, watching, pruned, hidden]
  );

  const tabList =
    tab === "worth"
      ? worth_a_look
      : tab === "watching"
        ? watching
        : tab === "pruned"
          ? pruned
          : tab === "hidden"
            ? hidden
            : all;

  const sorted = useMemo(() => {
    const arr = [...tabList];
    if (sort === "price") arr.sort((a, b) => b.monthly_cents - a.monthly_cents);
    else if (sort === "age") {
      arr.sort((a, b) => {
        const ax = a.last_charged_at ? new Date(a.last_charged_at).getTime() : 0;
        const bx = b.last_charged_at ? new Date(b.last_charged_at).getTime() : 0;
        return ax - bx;
      });
    } else if (sort === "category") {
      arr.sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          b.monthly_cents - a.monthly_cents
      );
    }
    return arr;
  }, [tabList, sort]);

  if (all.length === 0) return null;

  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visible.length;

  function changeTab(t: Tab) {
    setTab(t);
    setVisibleCount(PAGE_SIZE);
  }

  function postFeedback(
    subscription_id: string,
    override_type: "confirmed" | "cancelled"
  ) {
    startTransition(async () => {
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription_id, override_type }),
        });
        router.refresh();
      } catch {
        // ignore
      }
    });
  }

  function onKeep(item: ActionItem) {
    postFeedback(item.subscription_id, "confirmed");
  }

  function onCancelClick(item: ActionItem) {
    setCancelTarget(toSubLike(item));
  }

  // Called by CancelModal once the cancellation is recorded via
  // /api/cancellations. We also POST /api/feedback to move the row
  // into the Pruned tab and trigger the celebration animation.
  function onCancelConfirmed(subscriptionId: string) {
    const target = cancelTarget;
    setCancelTarget(null);
    if (!target) return;
    const annual =
      monthlyEquivalentCents(target.amount_cents, target.frequency) * 12;
    setCelebrate({
      annualSaved: annual / 100,
      merchant: target.merchant_name,
    });
    postFeedback(subscriptionId, "cancelled");
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      <CancelCelebration
        annualSaved={celebrate?.annualSaved ?? 0}
        merchant={celebrate?.merchant ?? ""}
        visible={!!celebrate}
        onDone={() => setCelebrate(null)}
      />
      <CancelModal
        sub={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirmed={onCancelConfirmed}
      />

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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-hairline">
        <div className="flex items-center gap-1 -mb-px overflow-x-auto">
          <TabBtn active={tab === "worth"} onClick={() => changeTab("worth")} label="Worth a look" count={worth_a_look.length} />
          <TabBtn active={tab === "watching"} onClick={() => changeTab("watching")} label="Watching" count={watching.length} />
          <TabBtn active={tab === "pruned"} onClick={() => changeTab("pruned")} label="Pruned" count={pruned.length} />
          {hidden.length > 0 && (
            <TabBtn active={tab === "hidden"} onClick={() => changeTab("hidden")} label="Hidden" count={hidden.length} muted />
          )}
          <TabBtn active={tab === "all"} onClick={() => changeTab("all")} label="All" count={all.length} />
        </div>
        <SortControl value={sort} onChange={setSort} />
      </div>

      <div className="mt-4">
        {sorted.length === 0 ? (
          <EmptyTab tab={tab} />
        ) : (
          <div className="divide-y divide-hairline">
            {visible.map((item) => (
              <Row
                key={item.subscription_id}
                item={item}
                tab={tab}
                onCancel={() => onCancelClick(item)}
                onKeep={() => onKeep(item)}
              />
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

// ─── Tab + sort ────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  label,
  count,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative h-10 px-3 md:px-4 border-b-2 inline-flex items-center gap-2 text-[13px] md:text-[14px] font-medium transition whitespace-nowrap",
        active
          ? "border-ink text-ink"
          : muted
            ? "border-transparent text-ink-muted hover:text-ink"
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

function Row({
  item,
  tab,
  onCancel,
  onKeep,
}: {
  item: ActionItem;
  tab: Tab;
  onCancel: () => void;
  onKeep: () => void;
}) {
  const muted = tab === "hidden" || item.override_type === "not_subscription" || item.override_type === "not_recurring";
  const pruned = tab === "pruned" || item.override_type === "cancelled";

  return (
    <div className={["group flex items-center gap-2.5 md:gap-4 py-2.5 md:py-4 -mx-2 px-2 rounded-lg transition", muted ? "opacity-50" : "hover:bg-ink/[0.03]"].join(" ")}>
      <Link
        href={`/app/subscriptions/${item.subscription_id}`}
        className="flex items-center gap-2.5 md:gap-4 flex-1 min-w-0"
      >
        <MerchantLogo
          name={item.merchant_name}
          domain={item.domain}
          size={28}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap min-w-0">
            <span
              className={[
                "text-[13.5px] md:text-[15px] font-medium truncate group-hover:underline decoration-ink/30 underline-offset-2",
                pruned ? "line-through text-ink-muted" : "text-ink",
              ].join(" ")}
            >
              {item.merchant_name}
            </span>
            {/* Tags hidden on phone — they fight for horizontal space. */}
            <span className="hidden sm:contents">
              {item.tags.map((t) => (
                <Tag key={t} kind={t === "Biggest line item" ? "primary" : "subtle"}>
                  {t}
                </Tag>
              ))}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] md:text-[12px] text-ink-muted truncate">
            <span className="hidden sm:inline">
              {item.reason ?? prettyCategory(item.category)}
            </span>
            <span className="sm:hidden">
              {prettyCategory(item.category)}
            </span>
            {item.last_charged_at && (
              <>
                <span className="hidden sm:inline">{" · last "}</span>
                <span className="sm:hidden">{" · "}</span>
                {new Date(item.last_charged_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </>
            )}
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="text-right">
          <div className={[
            "text-[13px] md:text-[15px] font-medium tabular-nums",
            pruned ? "text-ink-muted line-through" : "text-ink",
          ].join(" ")}>
            {fmt(item.monthly_cents)}<span className="text-ink-muted">/mo</span>
          </div>
          {/* Yearly hidden on phone for density. */}
          <div className="hidden sm:block text-[11px] text-ink-muted tabular-nums">
            {fmt(item.yearly_cents, { withCents: false })}/yr
          </div>
        </div>

        {tab === "worth" || tab === "all" ? (
          <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-hairline bg-surface px-3 text-[12px] font-medium text-ink hover:border-accent hover:bg-accent hover:text-white transition"
            >
              <X size={11} />
              Cancel
            </button>
            <button
              type="button"
              onClick={onKeep}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-hairline bg-surface px-3 text-[12px] font-medium text-ink hover:bg-ink/[0.04] transition"
            >
              <Check size={11} />
              Keep
            </button>
          </div>
        ) : null}

        <Link
          href={`/app/subscriptions/${item.subscription_id}`}
          className="inline-flex items-center gap-1 h-7 md:h-8 px-2.5 md:px-3 rounded-full border border-hairline bg-surface group-hover:bg-ink/[0.04] text-ink text-[11.5px] md:text-[12px] font-medium transition"
        >
          <span className="hidden sm:inline">Review</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </div>
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
        ? "Subscriptions you keep will appear here."
        : tab === "pruned"
          ? "Subscriptions you cancel will appear here."
          : tab === "hidden"
            ? "Subscriptions you mark as not a subscription will appear here, dimmed."
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

// Silence ESLint for the unused annualCents import — keep imported
// because CancelModal/SubLike expect identical semantics with the
// celebration calculation above.
void annualCents;
