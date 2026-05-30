"use client";

// SubscriptionsBrowser — the "Your subs" deep view at /app/spending.
//
// PASS 2 rebuild (task 107):
//   • Renders ALL confirmed subscriptions, not just a category list.
//   • Filter chips by category + free-text search.
//   • Group toggle: by category vs flat sorted-by-amount.
//   • Clicking a sub opens an OVERLAY MODAL (no navigation away).
//   • Modal carries: cancel-assist link, "Not a subscription"
//     feedback, and a link out to the full history page.
//
// Override actions hit POST /api/feedback. Optimistic UI removes the
// row immediately when the user flags "Not a subscription"; the
// background mutation is fire-and-forget with router.refresh on
// settle so the engine state and the UI re-converge.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Search, X, ChevronRight } from "lucide-react";
import type { ActionItem } from "@/lib/selectors/dashboard";
import { MerchantLogo } from "@/components/app/merchant-logo";
import { CancelModal } from "@/components/app/cancel-modal";
import type { SubLike } from "@/lib/subscription-math";
import {
  SubscriptionDetailModal,
  type DetailSub,
} from "@/components/app/subscription-detail-modal";

type Sub = Pick<
  ActionItem,
  | "subscription_id"
  | "merchant_name"
  | "domain"
  | "category"
  | "monthly_cents"
  | "amount_cents"
  | "currency"
  | "frequency"
  | "next_expected_charge_at"
  | "last_charged_at"
  | "status"
  | "confidence"
  | "override_type"
>;

type Props = {
  subs: Sub[];
  // Subs that have a "negative" override (not_subscription, cancelled,
  // not_recurring). Rendered in a dimmed group below the live list
  // with a one-tap "Mark as sub" restore.
  excluded?: Sub[];
};

function fmtCategory(c: string): string {
  return c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function fmtCents(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SubscriptionsBrowser({
  subs: initialSubs,
  excluded: initialExcluded = [],
}: Props) {
  const router = useRouter();
  const [subs, setSubs] = useState<Sub[]>(initialSubs);
  const [excluded, setExcluded] = useState<Sub[]>(initialExcluded);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [grouped, setGrouped] = useState(true);
  const [query, setQuery] = useState("");
  const [openSub, setOpenSub] = useState<Sub | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Sub | null>(null);

  // Refresh local state when the parent re-renders with new data
  // (e.g. after a router.refresh() following an override write).
  useEffect(() => {
    setSubs(initialSubs);
  }, [initialSubs]);
  useEffect(() => {
    setExcluded(initialExcluded);
  }, [initialExcluded]);

  // Categories + totals for filter chips.
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subs) {
      map.set(s.category, (map.get(s.category) ?? 0) + s.monthly_cents);
    }
    return Array.from(map.entries())
      .map(([category, monthly_cents]) => ({ category, monthly_cents }))
      .sort((a, b) => b.monthly_cents - a.monthly_cents);
  }, [subs]);

  // Filtered set after category + search.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subs.filter((s) => {
      if (activeCategory !== "all" && s.category !== activeCategory)
        return false;
      if (q && !s.merchant_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [subs, activeCategory, query]);

  // Grouped view payload — sort categories by total desc.
  const groupedView = useMemo(() => {
    const map = new Map<string, Sub[]>();
    for (const s of filtered) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries())
      .map(([category, items]) => ({
        category,
        items: items
          .slice()
          .sort((a, b) => b.monthly_cents - a.monthly_cents),
        total: items.reduce((acc, s) => acc + s.monthly_cents, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Flat view payload — sorted by amount desc.
  const flatView = useMemo(
    () => filtered.slice().sort((a, b) => b.monthly_cents - a.monthly_cents),
    [filtered]
  );

  // Optimistically remove a sub from the local list when the user
  // marks it as "Not a subscription". The background API call hits
  // /api/feedback and the dashboard re-renders on settle.
  const markNotSub = async (sub: Sub) => {
    // Optimistic — pull from active list AND push into excluded so
    // the dimmed group reflects the move instantly.
    setSubs((prev) =>
      prev.filter((s) => s.subscription_id !== sub.subscription_id)
    );
    setExcluded((prev) => [
      { ...sub, override_type: "not_subscription" },
      ...prev,
    ]);
    setOpenSub(null);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription_id: sub.subscription_id,
          override_type: "not_subscription",
        }),
      });
    } catch {
      // optimistic state reconciles on next router.refresh
    }
    router.refresh();
  };

  // Restore — flip an excluded sub back into the active list by
  // overriding with "confirmed". Optimistically updates locally and
  // refreshes the server tree so every total syncs.
  const restoreSub = async (sub: Sub) => {
    setExcluded((prev) =>
      prev.filter((s) => s.subscription_id !== sub.subscription_id)
    );
    setSubs((prev) => [{ ...sub, override_type: "confirmed" }, ...prev]);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription_id: sub.subscription_id,
          override_type: "confirmed",
        }),
      });
    } catch {
      // optimistic; reconciles on refresh
    }
    router.refresh();
  };

  // Live total + count derived from the local state so mark/restore
  // mutations re-render the header immediately. router.refresh()
  // then reconciles every other server-rendered surface (home card,
  // calendar, insights, share, charts, etc.).
  const liveMonthlyCents = subs.reduce((acc, s) => acc + s.monthly_cents, 0);

  return (
    <div>
      {/* ─── Live totals strip ─────────────────────────────── */}
      <div
        className="mb-5 text-[13px] text-ink-body tabular-nums ml-[40px]"
        aria-live="polite"
      >
        <span key={liveMonthlyCents} className="fr-number-fade inline-block">
          ${Math.round(liveMonthlyCents / 100).toLocaleString("en-US")}/mo
          recurring
        </span>{" "}
        ·{" "}
        <span key={subs.length} className="fr-number-fade inline-block">
          {subs.length} sub{subs.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* ─── Search + view toggle ──────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subscriptions"
            className="w-full h-10 pl-9 pr-9 rounded-full border border-hairline bg-white text-[13px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink/30 transition"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-ink/[0.05] text-ink-muted"
              aria-label="Clear search"
            >
              <X size={12} strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <div className="inline-flex items-center rounded-full border border-hairline bg-white p-0.5">
          <ToggleChip active={grouped} onClick={() => setGrouped(true)}>
            By category
          </ToggleChip>
          <ToggleChip active={!grouped} onClick={() => setGrouped(false)}>
            All subs
          </ToggleChip>
        </div>
      </div>

      {/* ─── Category filter chips ─────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
        <FilterChip
          active={activeCategory === "all"}
          onClick={() => setActiveCategory("all")}
          label="All"
          count={subs.length}
        />
        {categories.map((c) => (
          <FilterChip
            key={c.category}
            active={activeCategory === c.category}
            onClick={() => setActiveCategory(c.category)}
            label={fmtCategory(c.category)}
            count={
              subs.filter((s) => s.category === c.category).length
            }
          />
        ))}
      </div>

      {/* ─── List ──────────────────────────────────────────── */}
      <div className="mt-5">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-white p-6 text-center">
            <div className="text-[14px] font-bold text-ink">
              No subscriptions match
            </div>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Try clearing the filter or search.
            </p>
          </div>
        ) : grouped ? (
          <div className="space-y-4">
            {groupedView.map((group) => (
              <div
                key={group.category}
                className="rounded-2xl border border-hairline bg-white shadow-soft overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-hairline/60 bg-canvas/30">
                  <div className="text-[13px] font-bold text-ink">
                    {fmtCategory(group.category)}
                    <span className="ml-2 text-[11.5px] font-normal text-ink-muted tabular-nums">
                      · {group.items.length} sub
                      {group.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="text-[12.5px] font-bold text-ink tabular-nums">
                    {fmtCents(group.total)}/mo
                  </div>
                </div>
                <ul className="divide-y divide-hairline/60">
                  {group.items.map((s) => (
                    <li key={s.subscription_id}>
                      <SubRow sub={s} onOpen={() => setOpenSub(s)} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-hairline bg-white shadow-soft overflow-hidden">
            <ul className="divide-y divide-hairline/60">
              {flatView.map((s) => (
                <li key={s.subscription_id}>
                  <SubRow sub={s} onOpen={() => setOpenSub(s)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ─── Excluded (dimmed) group ───────────────────────── */}
      {excluded.length > 0 ? (
        <ExcludedGroup excluded={excluded} onRestore={restoreSub} />
      ) : null}

      {openSub ? (
        <SubscriptionDetailModal
          sub={toDetailSub(openSub)}
          onClose={() => setOpenSub(null)}
          onMarkNotSub={() => markNotSub(openSub)}
          onCancelAssist={() => {
            const target = openSub;
            setOpenSub(null);
            setCancelTarget(target);
          }}
        />
      ) : null}

      {cancelTarget ? (
        <CancelModal
          sub={toCancelSubLike(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          onConfirmed={() => {
            // Pull from live list and into the muted "excluded" group
            // immediately so the user sees the move. Server-side
            // CancelModal posts the cancellation; we then refresh
            // the server tree so totals reconcile.
            setSubs((prev) =>
              prev.filter(
                (s) => s.subscription_id !== cancelTarget.subscription_id
              )
            );
            setExcluded((prev) => [
              { ...cancelTarget, override_type: "cancelled" },
              ...prev,
            ]);
            setCancelTarget(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

// Adapt our local Sub into the SubLike contract CancelModal expects.
function toCancelSubLike(s: Sub): SubLike {
  return {
    id: s.subscription_id,
    merchant_name: s.merchant_name,
    amount_cents: s.amount_cents,
    currency: s.currency,
    frequency: s.frequency,
    last_charged_at: s.last_charged_at,
    next_expected_charge_at: s.next_expected_charge_at,
    status: s.status,
  };
}

// Adapt our local Sub into the shared DetailSub the modal consumes.
function toDetailSub(s: Sub): DetailSub {
  return {
    subscription_id: s.subscription_id,
    merchant_name: s.merchant_name,
    domain: s.domain,
    category: s.category,
    monthly_cents: s.monthly_cents,
    amount_cents: s.amount_cents,
    currency: s.currency,
    frequency: s.frequency,
    next_expected_charge_at: s.next_expected_charge_at,
    last_charged_at: s.last_charged_at,
    status: s.status,
    confidence: s.confidence,
  };
}

// ─── Excluded group (cancelled + not-a-sub) ────────────────────

function excludedLabel(t: string | null | undefined): string {
  switch (t) {
    case "cancelled":
      return "Cancelled";
    case "not_subscription":
      return "Not a sub";
    case "not_recurring":
      return "Not recurring";
    default:
      return "Excluded";
  }
}

function ExcludedGroup({
  excluded,
  onRestore,
}: {
  excluded: Sub[];
  onRestore: (sub: Sub) => void;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-hairline bg-ink/[0.02] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-hairline/60">
        <div className="text-[12.5px] font-bold text-ink-muted">
          Cancelled & not-a-sub
          <span className="ml-2 text-[11.5px] font-normal tabular-nums">
            · {excluded.length}
          </span>
        </div>
        <div className="text-[11px] text-ink-muted">
          Tap restore to bring one back
        </div>
      </div>
      <ul className="divide-y divide-hairline/60">
        {excluded.map((s) => (
          <li key={s.subscription_id} className="opacity-70">
            <div className="flex items-center gap-3 px-4 md:px-5 py-3">
              <MerchantLogo
                name={s.merchant_name}
                domain={s.domain}
                size={28}
                rounded="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-[13.5px] font-bold text-ink-body truncate">
                    {s.merchant_name}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-ink/[0.06] text-ink-muted px-1.5 h-4 text-[9.5px] font-medium uppercase tracking-[0.06em] shrink-0">
                    {excludedLabel(s.override_type)}
                  </span>
                </div>
                <div className="text-[11px] text-ink-muted truncate">
                  {fmtCategory(s.category)} · was {fmtCents(s.monthly_cents)}/mo
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRestore(s)}
                className="inline-flex items-center h-8 px-3 rounded-full border border-hairline bg-white text-[11.5px] font-medium text-ink hover:bg-ink/[0.04] transition shrink-0"
              >
                Mark as sub
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────

function SubRow({ sub, onOpen }: { sub: Sub; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-center gap-3 px-4 md:px-5 py-3.5 hover:bg-canvas/40 transition"
    >
      <MerchantLogo
        name={sub.merchant_name}
        domain={sub.domain}
        size={32}
        rounded="lg"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold text-ink truncate">
          {sub.merchant_name}
        </div>
        <div className="text-[11.5px] text-ink-muted truncate">
          {fmtCategory(sub.category)} · next {fmtDate(sub.next_expected_charge_at)}
        </div>
      </div>
      <div className="text-[13.5px] font-bold text-ink tabular-nums shrink-0">
        {fmtCents(sub.monthly_cents)}/mo
      </div>
      <ChevronRight
        size={14}
        strokeWidth={2}
        className="text-ink-muted shrink-0"
      />
    </button>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-8 px-3 rounded-full text-[12px] font-medium transition",
        active
          ? "bg-ink text-canvas"
          : "text-ink-muted hover:text-ink hover:bg-ink/[0.04]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function FilterChip({
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
        "shrink-0 h-8 px-3 rounded-full text-[12px] font-medium border transition tabular-nums",
        active
          ? "bg-ink text-canvas border-ink"
          : "bg-white text-ink-body border-hairline hover:border-ink/30 hover:text-ink",
      ].join(" ")}
    >
      {label}
      <span className={active ? "ml-1.5 opacity-70" : "ml-1.5 text-ink-muted"}>
        {count}
      </span>
    </button>
  );
}

// Modal moved to components/app/subscription-detail-modal.tsx so it
// can be reused from any surface (Coming-up renewals, etc.).
