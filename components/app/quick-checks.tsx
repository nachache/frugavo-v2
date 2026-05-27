"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { OpenDoubt } from "@/lib/doubt/load";

// QuickChecks — Layer 1 dashboard module, above the DecisionStrip.
//
// Renders 3-5 open doubts (confidence 0.55–0.85 zone, plus any
// auto-promoted scan-chip items from the 7-day rule). Each row is a
// single subscription with a one-tap chip set:
//
//   ✓ Yes      → resolution='confirmed' (real subscription)
//   Not a sub  → resolution='not_sub'
//   Shared     → resolution='shared'   (still a sub, just shared)
//   Work       → resolution='work'
//   Family     → resolution='family'
//   Skip       → dismiss (bumps ignored_count; 2 = silenced)
//
// Copy is intentionally in-character: "Help Frugavo understand your
// subscriptions better." NOT "Fix our classifier." Never make the
// user feel like they're labeling training data.
//
// Behavior contract:
//   - Collapsible (state in localStorage). Auto-expands when new
//     items arrive.
//   - Auto-hides when empty. No "everything's clear!" empty state —
//     the section just doesn't render.
//   - Optimistic UI: chip tap removes the row immediately, then the
//     server call fires. On failure, the row reappears with an error
//     line.

type Props = {
  items: OpenDoubt[];
};

const STORAGE_KEY = "frugavo:quick_checks_collapsed_v1";

export function QuickChecks({ items: initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Auto-hide when nothing to show. Important: this branch runs every
  // render so once the user resolves everything, the section vanishes
  // on the next paint.
  if (items.length === 0) return null;

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }

  async function resolve(id: string, resolution: ResolutionChoice) {
    // Optimistic remove. If the request fails, we'll re-insert below.
    const removed = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setErrorIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    try {
      const res = await fetch(`/api/doubt/${id}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolution, surface: "dashboard_module" }),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      // Refresh server state — the resolution may have unlocked
      // additional items for the user (e.g. if we ever fetch more
      // than 5 and pop the queue).
      startTransition(() => router.refresh());
    } catch {
      // Restore the row + mark it errored.
      if (removed) {
        setItems((prev) => [removed, ...prev]);
      }
      setErrorIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }

  async function dismiss(id: string) {
    const removed = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setErrorIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    try {
      const res = await fetch(`/api/doubt/${id}/dismiss`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ surface: "dashboard_module" }),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      startTransition(() => router.refresh());
    } catch {
      if (removed) {
        setItems((prev) => [removed, ...prev]);
      }
      setErrorIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }

  return (
    <section
      className="rounded-2xl border border-hairline bg-surface p-5 md:p-6"
      aria-labelledby="quick-checks-heading"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[11.5px] md:text-[12px] font-medium uppercase tracking-[0.1em] text-ink-muted">
            <Sparkles size={12} strokeWidth={2.2} className="text-brand" />
            Quick checks
          </div>
          <h2
            id="quick-checks-heading"
            className="mt-1.5 font-display text-[16.5px] md:text-[18px] font-semibold tracking-[-0.015em] text-ink leading-tight"
          >
            Help Frugavo understand your subscriptions better.
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-body">
            {items.length === 1
              ? "One charge needs your eyes."
              : `${items.length} charges need your eyes.`}{" "}
            Tap a chip — takes a second.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="quick-checks-list"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition"
        >
          {collapsed ? (
            <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <ChevronUp size={16} strokeWidth={2.2} aria-hidden="true" />
          )}
          <span className="sr-only">
            {collapsed ? "Expand quick checks" : "Collapse quick checks"}
          </span>
        </button>
      </header>

      {!collapsed && (
        <ul
          id="quick-checks-list"
          className="mt-4 md:mt-5 space-y-2.5 md:space-y-3"
        >
          {items.map((item) => (
            <DoubtRow
              key={item.id}
              item={item}
              errored={errorIds.has(item.id)}
              onResolve={resolve}
              onDismiss={dismiss}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Per-doubt row.
// ──────────────────────────────────────────────────────────────────────

type ResolutionChoice =
  | "confirmed"
  | "not_sub"
  | "shared"
  | "work"
  | "family";

function DoubtRow({
  item,
  errored,
  onResolve,
  onDismiss,
}: {
  item: OpenDoubt;
  errored: boolean;
  onResolve: (id: string, resolution: ResolutionChoice) => void;
  onDismiss: (id: string) => void;
}) {
  const amount = useMemo(
    () => formatAmount(item.display.amount_cents, item.display.currency),
    [item.display.amount_cents, item.display.currency]
  );
  const cadence = useMemo(
    () => prettyCadence(item.display.frequency),
    [item.display.frequency]
  );
  const lastDate = useMemo(
    () => formatDate(item.display.last_charged_at),
    [item.display.last_charged_at]
  );

  return (
    <li className="rounded-xl border border-hairline/60 bg-canvas/40 px-3.5 py-3 md:px-4 md:py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[14.5px] font-medium text-ink">
          {item.display.merchant_name}
        </span>
        <span className="text-[13px] text-ink-muted tabular-nums">
          {amount} · {cadence}
        </span>
        {lastDate ? (
          <span className="text-[12px] text-ink-muted/80 tabular-nums">
            last {lastDate}
          </span>
        ) : null}
        {item.auto_promoted_at ? (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-ink/[0.04] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-muted"
            title="Auto-promoted after 7 days without an answer."
          >
            low confidence
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Chip
          onClick={() => onResolve(item.id, "confirmed")}
          variant="primary"
          icon={<Check size={12} strokeWidth={2.5} />}
        >
          Real sub
        </Chip>
        <Chip
          onClick={() => onResolve(item.id, "not_sub")}
          icon={<X size={12} strokeWidth={2.5} />}
        >
          Not a sub
        </Chip>
        <Chip onClick={() => onResolve(item.id, "shared")}>Shared</Chip>
        <Chip onClick={() => onResolve(item.id, "work")}>Work</Chip>
        <Chip onClick={() => onResolve(item.id, "family")}>Family</Chip>
        <Chip onClick={() => onDismiss(item.id)} variant="ghost">
          Skip
        </Chip>
      </div>

      {errored ? (
        <p className="mt-2 text-[11.5px] text-danger">
          Couldn&apos;t save that — try again.
        </p>
      ) : null}
    </li>
  );
}

function Chip({
  children,
  onClick,
  variant,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost";
  icon?: React.ReactNode;
}) {
  const cls =
    variant === "primary"
      ? "bg-ink text-canvas hover:bg-ink/85 border-ink"
      : variant === "ghost"
        ? "bg-transparent text-ink-muted hover:text-ink hover:bg-ink/[0.04] border-transparent"
        : "bg-surface text-ink hover:bg-ink/[0.04] border-hairline";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1 h-7 px-3 rounded-full text-[12px] font-medium border transition " +
        cls
      }
    >
      {icon}
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Formatters — kept inline to avoid a new lib file for cosmetic work.
// ──────────────────────────────────────────────────────────────────────

function formatAmount(cents: number, currency: string): string {
  const abs = Math.abs(cents) / 100;
  const sym = currency === "USD" || currency === "CAD" ? "$" : "";
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${formatted}`;
}

function prettyCadence(f: string): string {
  return f.replace(/_/g, " ");
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}
