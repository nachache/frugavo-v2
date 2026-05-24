"use client";

// SpendingPatternsAccordion — the collapsed "Recurring spending
// patterns" section that holds everything classified as
// recurring_commerce.
//
// IMPORTANT DESIGN NOTES (from the trust-rebuild brief):
//
//   - Collapsed by default. The section header is the only thing
//     visible until the user opts in.
//   - Visually softer than subscriptions. Muted text, smaller type,
//     no logos in the row. The point is to feel like a secondary
//     observation, not the main event.
//   - Excluded from hero totals, personality, protection alerts. The
//     accordion is the ONLY surface this data appears on.
//   - Each row has a "Yes, this is a subscription" promotion button.
//     Clicking it posts feedback override_type=confirmed which moves
//     the merchant to the subscription tier on the next render.
//
// The accordion auto-hides when there are 0 commerce items, so it
// never adds visual noise to a clean dashboard.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CommerceItem = {
  id: string;
  merchant_name: string;
  monthly_cents: number;
};

type Props = {
  items: CommerceItem[];
};

function fmt(c: number): string {
  return `$${(c / 100).toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SpendingPatternsAccordion({ items }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [promoting, setPromoting] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Auto-hide when there's nothing to show. The accordion should NEVER
  // appear empty — that would imply the engine found nothing when in
  // fact the user might have plenty of commerce charges that just
  // didn't recur regularly enough.
  if (items.length === 0) return null;

  function promote(id: string) {
    setPromoting((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription_id: id,
            override_type: "confirmed",
          }),
        });
        // Refresh the dashboard so this item moves to the main
        // subscription list and the totals recompute.
        router.refresh();
      } finally {
        setPromoting((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-hairline/70 bg-canvas/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 md:py-4 text-left hover:bg-ink/[0.02] transition"
      >
        <div className="min-w-0">
          <div className="text-[13px] md:text-[14px] font-medium text-ink">
            Recurring spending patterns
          </div>
          <div className="mt-0.5 text-[11.5px] md:text-[12.5px] text-ink-muted leading-snug">
            Places you visit regularly — not subscriptions. We watch
            them quietly but don&apos;t count them in your totals.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-ink-muted tabular-nums">
            {items.length} {items.length === 1 ? "merchant" : "merchants"}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={[
              "text-ink-muted transition-transform",
              open ? "rotate-180" : "",
            ].join(" ")}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {open && (
        <ul className="border-t border-hairline/60 divide-y divide-hairline/40">
          {items.map((it) => {
            const isPromoting = promoting.has(it.id);
            return (
              <li
                key={it.id}
                className="px-4 md:px-5 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] md:text-[14px] text-ink truncate">
                    {it.merchant_name}
                  </div>
                  <div className="mt-0.5 text-[11.5px] md:text-[12px] text-ink-muted tabular-nums">
                    ≈ {fmt(it.monthly_cents)}/mo
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => promote(it.id)}
                  disabled={isPromoting}
                  className="text-[11.5px] md:text-[12px] font-medium text-brand hover:text-brand-hover transition disabled:opacity-50 shrink-0"
                >
                  {isPromoting ? "Saving…" : "Actually a subscription?"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
