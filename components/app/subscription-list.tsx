"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ChevronDown, Sparkles } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  asCategory,
  type Category,
} from "@/lib/categories";
import {
  annualCents,
  cancelCandidates,
  monthlyEquivalentCents,
  type ChargeRow,
  type SubLike,
} from "@/lib/subscription-math";
import { BrandLogo } from "./brand-logo";
import { DashboardHero } from "./dashboard-hero";
import { CancelCandidates } from "./cancel-candidates";
import { CancelModal } from "./cancel-modal";
import { PendingCancellations } from "./pending-cancellations";
import { CancelCelebration } from "./cancel-celebration";
import { PrunedRail } from "./pruned-rail";
import { SavingsCounter } from "./savings-counter";

// Row shape exposed to the dashboard page. Mirrors the DB columns we
// select in app/app/page.tsx; matches the SubLike shape from the math
// module so we can pass straight through.
export type Subscription = SubLike & {
  id: string;
  status: "active" | "cancelled" | "paused" | "uncertain";
  user_decision: "keep" | "cancel" | "unsure" | null;
};

export function SubscriptionList({
  initial,
  charges = [],
  lastScannedAt = null,
}: {
  initial: Subscription[];
  charges?: ChargeRow[];
  lastScannedAt?: string | null;
}) {
  const router = useRouter();
  // Single source of truth for every section on this page. Worth a look,
  // Currently running, Watching next bill, Pruned — all derived from
  // this one state via useMemo, so a state change anywhere instantly
  // propagates everywhere.
  const [items, setItems] = useState(initial);
  const [rescanning, startRescan] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<SubLike | null>(null);
  const [celebrate, setCelebrate] = useState<{
    annualSaved: number;
    merchant: string;
  } | null>(null);
  // How "Currently running" is sorted/grouped. Drives the visible
  // layout: "category" groups into collapsible category cards, the
  // other two flatten the list and sort within a single card.
  const [sortMode, setSortMode] = useState<"category" | "price" | "age">(
    "category"
  );
  const [openCategories, setOpenCategories] = useState<Set<Category>>(() => {
    const totals: Partial<Record<Category, number>> = {};
    for (const s of initial) {
      if (s.status !== "active") continue;
      const cat = asCategory(s.category);
      totals[cat] =
        (totals[cat] ?? 0) + monthlyEquivalentCents(s.amount_cents, s.frequency);
    }
    const top = Object.entries(totals).sort(
      (a, b) => (b[1] as number) - (a[1] as number)
    )[0];
    return new Set(top ? [top[0] as Category] : []);
  });

  const candidates = useMemo(() => cancelCandidates(items), [items]);

  const pendingCancellations = useMemo(
    () =>
      items.filter(
        (s) => s.status === "active" && s.user_decision === "cancel"
      ),
    [items]
  );

  // Currently running: active subs not pending cancellation. Kept subs
  // stay here — the user opted to keep them, so they belong on the
  // active list, just with a "Kept" chip instead of action buttons.
  const grouped = useMemo(() => {
    const map = new Map<Category, Subscription[]>();
    for (const s of items) {
      if (s.status !== "active") continue;
      if (s.user_decision === "cancel") continue;
      // Classifier verdict gate — needs_review rows are stored for
      // audit but must NOT appear in Currently Running.
      if (s.classification && s.classification !== "confirmed") continue;
      const cat = asCategory(s.category);
      const arr = map.get(cat) ?? [];
      arr.push(s);
      map.set(cat, arr);
    }
    return Array.from(map.entries())
      .map(([cat, subs]) => ({
        category: cat,
        subs: subs.sort(
          (a, b) =>
            monthlyEquivalentCents(b.amount_cents, b.frequency) -
            monthlyEquivalentCents(a.amount_cents, a.frequency)
        ),
        subtotal: subs.reduce(
          (sum, s) =>
            sum + monthlyEquivalentCents(s.amount_cents, s.frequency),
          0
        ),
      }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [items]);

  const cancelled = useMemo(
    () => items.filter((s) => s.status === "cancelled"),
    [items]
  );

  const triggerRescan = () => {
    // Route to /app/scanning instead of firing a background fetch.
    // Two reasons:
    //   1. The /app/scanning page kicks off the real scan via
    //      runScanForUser and renders the StreamingList component
    //      with a progress arc + row-by-row reveal — proper loading
    //      UX. The dashboard's in-place "Watering…" label is too
    //      subtle and users can't tell anything is happening.
    //   2. Avoids hitting /api/plaid/scan (which was a 404 — the
    //      route lives at /api/scan/rescan now). The 404 silently
    //      failed and left the dashboard in a stale state.
    startRescan(() => {
      router.push("/app/scanning");
    });
  };

  // Keyboard shortcut: 'R' triggers a re-scan. We guard against firing
  // while the user is typing in a form field, while the cancel modal
  // is open, or while the celebration is playing. Keeps the shortcut
  // useful without surprising people in unrelated contexts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "r" && e.key !== "R") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // let Cmd-R reload
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      if (cancelTarget || celebrate || rescanning) return;
      e.preventDefault();
      triggerRescan();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // triggerRescan is stable for our purposes (calls startTransition);
    // the deps below cover the gating conditions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelTarget, celebrate, rescanning]);

  // ---------- decision handlers ----------

  const openCancel = (s: SubLike) => setCancelTarget(s);
  const closeCancel = () => setCancelTarget(null);

  const onCancelConfirmed = (subId: string) => {
    const target = items.find((s) => s.id === subId);
    // Single state update — every derived view re-renders automatically.
    setItems((prev) =>
      prev.map((s) =>
        s.id === subId ? { ...s, user_decision: "cancel" as const } : s
      )
    );
    setCancelTarget(null);

    if (target) {
      const annual =
        monthlyEquivalentCents(target.amount_cents, target.frequency) * 12;
      setCelebrate({
        annualSaved: annual / 100,
        merchant: target.merchant_name,
      });
    }
  };

  // Keep — optimistic UI flip, then POST. If the server fails we revert.
  const onKeep = async (sub: Subscription) => {
    const before = items;
    setItems((prev) =>
      prev.map((s) =>
        s.id === sub.id ? { ...s, user_decision: "keep" as const } : s
      )
    );
    try {
      const res = await fetch("/api/subscriptions/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription_id: sub.id,
          decision: "keep",
        }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[keep] failed", e);
      setItems(before);
    }
  };

  const toggleCategory = (cat: Category) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // ---------- empty state ----------

  if (items.length === 0) {
    return (
      <div className="rounded-3xl bg-white border border-hairline/60 p-8 text-center shadow-soft">
        <div className="mx-auto inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-brand-light text-brand">
          <Sparkles size={20} />
        </div>
        <p className="mt-4 text-[15px] text-ink-body max-w-[380px] mx-auto">
          No recurring charges yet. Plaid sandbox accounts sometimes take a few
          minutes — try a re-scan.
        </p>
        <button
          onClick={triggerRescan}
          disabled={rescanning}
          className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-[13px] font-medium text-white hover:bg-ink/85 transition disabled:opacity-50"
        >
          {rescanning ? "Watering…" : "Re-scan"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <SavingsCounter subs={items} />

      <DashboardHero
        subs={items}
        charges={charges}
        onRescan={triggerRescan}
        rescanning={rescanning}
        lastScannedAt={lastScannedAt}
      />

      <CancelCandidates candidates={candidates} onCancel={openCancel} />

      {/* Main + side-rail layout. On lg+ the right column shows the
          user's "wins" alongside the active list. On mobile both stack. */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        {/* MAIN COLUMN — currently running */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
              Currently running
            </h2>
            <SortToggle value={sortMode} onChange={setSortMode} />
          </div>

          {sortMode !== "category" && (
            <FlatList
              subs={flatSorted(items, sortMode)}
              onCancel={openCancel}
              onKeep={onKeep}
            />
          )}

          {sortMode === "category" && (
          <div className="mt-4 grid gap-3">
            {grouped.map(({ category, subs, subtotal }) => {
              const open = openCategories.has(category);
              return (
                <div
                  key={category}
                  className="rounded-3xl bg-white border border-hairline/60 shadow-soft overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-ink/[0.02] transition"
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: CATEGORY_COLOR[category] }}
                    />
                    <span className="flex-1 text-[14px] font-semibold text-ink">
                      {CATEGORY_LABEL[category]}
                    </span>
                    <span className="text-[12.5px] text-ink-muted tnum">
                      {subs.length} · {formatCurrency(subtotal / 100)}/mo
                    </span>
                    <ChevronDown
                      size={16}
                      className={cn(
                        "text-ink-muted transition-transform",
                        open && "rotate-180"
                      )}
                    />
                  </button>

                  {open && (
                    <ul className="grid gap-3 p-4 sm:p-5 sm:grid-cols-1 lg:grid-cols-2 bg-canvas/40">
                      {subs.map((s) => (
                        <SubscriptionRow
                          key={s.id}
                          sub={s}
                          onCancel={openCancel}
                          onKeep={onKeep}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </section>

        {/* SIDE RAIL — wins + pending watcher */}
        <aside className="space-y-5 lg:sticky lg:top-6 self-start">
          <PendingCancellations pending={pendingCancellations} compact />
          <PrunedRail cancelled={cancelled} />
        </aside>
      </div>

      <CancelModal
        sub={cancelTarget}
        onClose={closeCancel}
        onConfirmed={onCancelConfirmed}
      />

      <CancelCelebration
        visible={celebrate !== null}
        annualSaved={celebrate?.annualSaved ?? 0}
        merchant={celebrate?.merchant ?? ""}
        onDone={() => setCelebrate(null)}
      />
    </div>
  );
}

// ---------- sort + flat-list helpers ----------

// Flat active subs sorted by the chosen mode. Pending cancellations
// stay filtered out — they live in the side rail. Kept subs stay
// visible (just with a "Kept" chip) so the active list shows
// everything the user is still paying for. needs_review rows are
// filtered out so the dashboard only shows confirmed subscriptions.
function flatSorted(
  items: Subscription[],
  mode: "price" | "age"
): Subscription[] {
  const active = items.filter(
    (s) =>
      s.status === "active" &&
      s.user_decision !== "cancel" &&
      (!s.classification || s.classification === "confirmed")
  );
  return active.sort((a, b) => {
    if (mode === "price") {
      return (
        monthlyEquivalentCents(b.amount_cents, b.frequency) -
        monthlyEquivalentCents(a.amount_cents, a.frequency)
      );
    }
    // age — most-stale charge first (largest gap since last_charged_at)
    const aT = a.last_charged_at ? new Date(a.last_charged_at).getTime() : 0;
    const bT = b.last_charged_at ? new Date(b.last_charged_at).getTime() : 0;
    return aT - bT; // older first
  });
}

function SortToggle({
  value,
  onChange,
}: {
  value: "category" | "price" | "age";
  onChange: (v: "category" | "price" | "age") => void;
}) {
  const opts: { value: "category" | "price" | "age"; label: string }[] = [
    { value: "category", label: "Category" },
    { value: "price", label: "Most expensive" },
    { value: "age", label: "Oldest charge" },
  ];
  return (
    <div className="inline-flex rounded-full border border-hairline bg-white p-0.5">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 px-3 rounded-full text-[11.5px] font-medium transition",
            value === o.value
              ? "bg-ink text-white"
              : "text-ink-muted hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FlatList({
  subs,
  onCancel,
  onKeep,
}: {
  subs: Subscription[];
  onCancel: (s: Subscription) => void;
  onKeep: (s: Subscription) => void;
}) {
  if (subs.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-hairline/60 bg-white p-5 text-[14px] text-ink-muted">
        Nothing to show here.
      </p>
    );
  }
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
      {subs.map((s) => (
        <SubscriptionRow
          key={s.id}
          sub={s}
          onCancel={onCancel}
          onKeep={onKeep}
        />
      ))}
    </ul>
  );
}

// ---------- row ----------

function SubscriptionRow({
  sub,
  onCancel,
  onKeep,
}: {
  sub: Subscription;
  onCancel?: (sub: Subscription) => void;
  onKeep?: (sub: Subscription) => void;
}) {
  const monthly = monthlyEquivalentCents(sub.amount_cents, sub.frequency);
  const annual = annualCents(sub.amount_cents, sub.frequency);
  const cat = asCategory(sub.category);
  const pendingCancel = sub.user_decision === "cancel";
  const kept = sub.user_decision === "keep";

  return (
    <li
      className={cn(
        "rounded-2xl bg-white border border-hairline/60 p-4 flex flex-col gap-3 hover:shadow-soft transition-shadow",
        pendingCancel && "border-brand/40 bg-brand-light/30",
        kept && "border-ink/15"
      )}
    >
      <div className="flex items-start gap-3">
        <BrandLogo merchant={sub.merchant_name} category={sub.category} size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-ink truncate">
            {sub.merchant_name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: CATEGORY_COLOR[cat] }}
            />
            <span>{CATEGORY_LABEL[cat]}</span>
          </div>
        </div>
      </div>

      <div className="tnum">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[20px] font-display font-bold text-ink">
            {formatCurrency(monthly / 100)}
          </span>
          <span className="text-[11.5px] font-medium text-ink-muted">/mo</span>
        </div>
        <div className="text-[11.5px] text-ink-muted">
          {formatCurrency(annual / 100, false)}/yr
          {sub.last_charged_at && (
            <>
              <span className="text-ink/30 mx-1.5">·</span>
              <span>
                last{" "}
                {new Date(sub.last_charged_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </div>

      {pendingCancel ? (
        <span className="self-start inline-flex items-center gap-1 rounded-full bg-brand-light px-3 h-7 text-[11.5px] font-medium text-brand">
          <Check size={11} strokeWidth={3} />
          Cancelled — watching next bill
        </span>
      ) : kept ? (
        <span className="self-start inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-3 h-7 text-[11.5px] font-medium text-ink">
          <Check size={11} strokeWidth={3} />
          Kept
        </span>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onCancel?.(sub)}
            className="flex-1 inline-flex h-9 items-center justify-center gap-1 rounded-full border border-hairline bg-white px-3 text-[12.5px] font-medium text-ink hover:border-accent hover:bg-accent hover:text-white transition"
          >
            <X size={12} />
            Cancel
          </button>
          <button
            onClick={() => onKeep?.(sub)}
            className="flex-1 inline-flex h-9 items-center justify-center gap-1 rounded-full border border-hairline bg-white px-3 text-[12.5px] font-medium text-ink hover:bg-ink/[0.04] transition"
          >
            <Check size={12} />
            Keep
          </button>
        </div>
      )}
    </li>
  );
}
