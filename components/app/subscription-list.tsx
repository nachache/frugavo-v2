"use client";

import { useMemo, useState, useTransition } from "react";
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
}: {
  initial: Subscription[];
  charges?: ChargeRow[];
}) {
  const router = useRouter();
  const [items] = useState(initial);
  const [rescanning, startRescan] = useTransition();
  const [openCategories, setOpenCategories] = useState<Set<Category>>(() => {
    // Open only the most expensive category by default — the rest stay
    // collapsed so the page lands at a calm vertical height.
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
  const [showPruned, setShowPruned] = useState(false);

  const candidates = useMemo(() => cancelCandidates(items), [items]);

  const grouped = useMemo(() => {
    const map = new Map<Category, Subscription[]>();
    for (const s of items) {
      if (s.status !== "active") continue;
      const cat = asCategory(s.category);
      const arr = map.get(cat) ?? [];
      arr.push(s);
      map.set(cat, arr);
    }
    // Sort categories by their monthly subtotal desc.
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

  const cancelled = items.filter((s) => s.status === "cancelled");

  const triggerRescan = () => {
    startRescan(async () => {
      await fetch("/api/plaid/scan", { method: "POST" });
      router.refresh();
    });
  };

  const toggleCategory = (cat: Category) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Empty state — keep it consistent with the older list so first-time
  // users don't see a wildly different page.
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
      <DashboardHero
        subs={items}
        charges={charges}
        onRescan={triggerRescan}
        rescanning={rescanning}
      />

      <CancelCandidates candidates={candidates} />

      <section className="mt-10">
        <h2 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
          Currently running
        </h2>

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
                  <ul className="divide-y divide-hairline/60">
                    {subs.map((s) => (
                      <SubscriptionRow key={s.id} sub={s} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {cancelled.length > 0 && (
        <section className="mt-10">
          <button
            onClick={() => setShowPruned((v) => !v)}
            className="w-full text-left flex items-center justify-between text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-muted hover:text-ink transition"
          >
            <span>Pruned · {cancelled.length}</span>
            <ChevronDown
              size={14}
              className={cn(
                "transition-transform",
                showPruned && "rotate-180"
              )}
            />
          </button>
          {showPruned && (
            <ul className="mt-4 grid gap-3">
              {cancelled.map((s) => (
                <SubscriptionRow key={s.id} sub={s} cancelled />
              ))}
            </ul>
          )}
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
  const monthly = monthlyEquivalentCents(sub.amount_cents, sub.frequency);
  const annual = annualCents(sub.amount_cents, sub.frequency);
  const cat = asCategory(sub.category);

  return (
    <li
      className={cn(
        "px-5 py-4 flex items-center gap-4",
        cancelled && "opacity-60"
      )}
    >
      <BrandLogo merchant={sub.merchant_name} category={sub.category} size={40} />

      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-medium text-ink truncate">
          {sub.merchant_name}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-muted tnum">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: CATEGORY_COLOR[cat] }}
          />
          <span>{CATEGORY_LABEL[cat]}</span>
          {sub.last_charged_at && (
            <>
              <span className="text-ink/30">·</span>
              <span>
                last charged{" "}
                {new Date(sub.last_charged_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </div>

      {!cancelled ? (
        <div className="flex items-center gap-3">
          <div className="text-right tnum">
            <div className="text-[15.5px] font-display font-semibold text-ink">
              {formatCurrency(monthly / 100)}
              <span className="text-[11.5px] font-medium text-ink-muted">/mo</span>
            </div>
            <div className="text-[11px] text-ink-muted">
              {formatCurrency(annual / 100, false)}/yr
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <button
              disabled
              title="Cancel-assist ships in week 5"
              className="inline-flex h-9 items-center gap-1 rounded-full border border-hairline bg-white px-3 text-[12.5px] font-medium text-ink hover:border-accent hover:bg-accent hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={12} />
              Cancel
            </button>
            <button
              disabled
              className="inline-flex h-9 items-center gap-1 rounded-full border border-hairline bg-white px-3 text-[12.5px] font-medium text-ink hover:bg-ink/[0.04] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={12} />
              Keep
            </button>
          </div>
        </div>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-light px-3 h-8 text-[11.5px] font-medium text-brand">
          <Check size={11} strokeWidth={3} />
          Saved {formatCurrency(annual / 100, false)}/yr
        </span>
      )}
    </li>
  );
}
