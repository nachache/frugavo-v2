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
import {
  Search,
  X,
  ChevronRight,
  Scissors,
  ExternalLink,
  AlertCircle,
  Eye,
  CheckCircle2,
} from "lucide-react";
import type { ActionItem } from "@/lib/selectors/dashboard";
import { MerchantLogo } from "@/components/app/merchant-logo";

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
>;

type Props = {
  subs: Sub[];
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

export function SubscriptionsBrowser({ subs: initialSubs }: Props) {
  const router = useRouter();
  const [subs, setSubs] = useState<Sub[]>(initialSubs);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [grouped, setGrouped] = useState(true);
  const [query, setQuery] = useState("");
  const [openSub, setOpenSub] = useState<Sub | null>(null);

  // Refresh local state if the parent re-renders with new data (e.g.
  // after a router.refresh() following an override write).
  useEffect(() => {
    setSubs(initialSubs);
  }, [initialSubs]);

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
    setSubs((prev) =>
      prev.filter((s) => s.subscription_id !== sub.subscription_id)
    );
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
      // best-effort; the optimistic state will reconcile on next render
    }
    router.refresh();
  };

  return (
    <div>
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

      {openSub ? (
        <SubscriptionModal
          sub={openSub}
          onClose={() => setOpenSub(null)}
          onMarkNotSub={() => markNotSub(openSub)}
        />
      ) : null}
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

// ─── Modal ─────────────────────────────────────────────────────

function SubscriptionModal({
  sub,
  onClose,
  onMarkNotSub,
}: {
  sub: Sub;
  onClose: () => void;
  onMarkNotSub: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [confirmNotSub, setConfirmNotSub] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;

  const monthly = sub.monthly_cents;
  const nextDate = fmtDate(sub.next_expected_charge_at);
  const lastDate = fmtDate(sub.last_charged_at);
  const freq = sub.frequency === "unknown" ? "—" : sub.frequency;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full md:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-white shadow-float border border-hairline outline-none"
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-hairline px-5 md:px-7 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <MerchantLogo
              name={sub.merchant_name}
              domain={sub.domain}
              size={36}
              rounded="lg"
            />
            <div className="min-w-0">
              <h2
                id="sub-modal-title"
                className="font-display text-[17px] md:text-[18px] font-bold text-ink leading-tight truncate"
              >
                {sub.merchant_name}
              </h2>
              <div className="text-[11.5px] text-ink-muted truncate">
                {fmtCategory(sub.category)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-ink/[0.05] text-ink-muted hover:text-ink transition shrink-0"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 md:px-7 py-5 md:py-6 space-y-5">
          {/* Big monthly + cadence */}
          <div className="rounded-2xl border border-hairline bg-canvas/40 p-4">
            <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
              Monthly equivalent
            </div>
            <div className="mt-1 text-[28px] md:text-[32px] font-bold text-ink tabular-nums leading-none">
              {fmtCents(monthly)}
              <span className="ml-1.5 text-[13px] font-medium text-ink-muted">
                /mo
              </span>
            </div>
            <div className="mt-2 text-[12.5px] text-ink-body tabular-nums">
              Billed {fmtCents(sub.amount_cents)} · {freq}
            </div>
          </div>

          {/* Facts grid */}
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Next expected" value={nextDate} />
            <Fact label="Last charged" value={lastDate} />
            <Fact
              label="Status"
              value={
                sub.status.charAt(0).toUpperCase() + sub.status.slice(1)
              }
            />
            <Fact
              label="Confidence"
              value={
                sub.confidence !== null && sub.confidence !== undefined
                  ? `${Math.round(sub.confidence * 100)}%`
                  : "—"
              }
            />
          </dl>

          {/* Cancel Assist */}
          <div className="rounded-2xl border border-hairline bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-900">
                <Scissors size={13} strokeWidth={2} />
              </span>
              <div className="text-[13px] font-bold text-ink">
                Cancel assist
              </div>
            </div>
            <p className="mt-2 text-[12.5px] text-ink-body leading-relaxed">
              We&apos;ll walk you through the cancel flow with a direct
              link + step-by-step for the trickier merchants.
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Link
                href={`/app/subscriptions/${sub.subscription_id}?cancel=1`}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12.5px] font-medium text-white"
                style={{ background: "#0F6E56" }}
                onClick={onClose}
              >
                <Scissors size={12} strokeWidth={2} />
                Start cancel assist
              </Link>
              <Link
                href={`/app/subscriptions/${sub.subscription_id}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-hairline text-[12px] font-medium text-ink hover:bg-ink/[0.04] transition"
                onClick={onClose}
              >
                <Eye size={12} strokeWidth={2} />
                Full history
                <ExternalLink size={11} strokeWidth={2} className="text-ink-muted" />
              </Link>
            </div>
          </div>

          {/* Not a subscription */}
          {confirmNotSub ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={14}
                  strokeWidth={2}
                  className="text-amber-900 mt-0.5 shrink-0"
                />
                <div className="text-[12.5px] text-ink-body leading-relaxed">
                  Mark {sub.merchant_name} as not a subscription? We&apos;ll
                  hide it from totals and remember your call for next scan.
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onMarkNotSub}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-ink text-canvas text-[12.5px] font-medium"
                >
                  <CheckCircle2 size={12} strokeWidth={2} />
                  Yes, not a sub
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmNotSub(false)}
                  className="inline-flex items-center h-9 px-3 rounded-full text-[12px] font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition"
                >
                  Never mind
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmNotSub(true)}
              className="w-full inline-flex items-center justify-center h-10 px-4 rounded-full border border-hairline text-[12.5px] font-medium text-ink-body hover:text-ink hover:bg-ink/[0.04] transition"
            >
              Not a subscription
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas/30 px-3 py-2">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-bold text-ink tabular-nums">
        {value}
      </div>
    </div>
  );
}
