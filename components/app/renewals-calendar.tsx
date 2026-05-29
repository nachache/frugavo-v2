"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ActionItem } from "@/lib/selectors/dashboard";
import { MerchantLogo } from "@/components/app/merchant-logo";

// RenewalsCalendar — full-month grid + scrollable month agenda.
//
// PASS 2 redesign (task 106):
//   • Calendar lives inside a polished white card (border + shadow).
//   • Day cells are taller and breath more; days that carry charges
//     show a tinted background whose opacity scales with the day's
//     dollar magnitude — at-a-glance heat map.
//   • Today is a green pill. Selected day is a heavier outline.
//   • Below the grid: ALL the month's predicted charges grouped by
//     day, with merchant logos. Tapping a day in the grid smooth-
//     scrolls to that day's group and gives it a temporary brand
//     halo so the connection is obvious.
//   • Tapping a charge routes to /app/subscriptions/[id].

type Props = {
  year: number;
  month: number; // 0..11
  upcoming: ActionItem[];
  initialSelectedIso: string | null;
  // Subscription ids whose next_expected_charge_at was server-side
  // estimated from last_charged_at + cadence rather than coming from
  // the engine. UI tags these rows so the user sees the difference.
  approximateIds?: Set<string>;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayAnchorId(iso: string): string {
  return `renewal-day-${iso}`;
}

export function RenewalsCalendar({
  year,
  month,
  upcoming,
  initialSelectedIso,
  approximateIds,
}: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Build the grid. Sunday-anchored. Pads to a full 5 or 6 rows.
  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startOffset = first.getDay();
    const endPad = 6 - last.getDay();
    const total = startOffset + last.getDate() + endPad;
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(year, month, 1 - startOffset + i);
      cells.push({ date: d, inMonth: d.getMonth() === month });
    }
    return cells;
  }, [year, month]);

  // Bucket charges by ISO day for quick lookup.
  const chargesByDay = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const a of upcoming) {
      if (!a.next_expected_charge_at) continue;
      const iso = a.next_expected_charge_at.slice(0, 10);
      const list = map.get(iso) ?? [];
      list.push(a);
      map.set(iso, list);
    }
    // Sort each day's charges by amount desc so the heaviest hits
    // float to the top of each group.
    for (const list of map.values()) {
      list.sort((a, b) => b.monthly_cents - a.monthly_cents);
    }
    return map;
  }, [upcoming]);

  // Compute per-day totals + the month's peak for the heat ramp.
  const { totalsByDay, peakCents } = useMemo(() => {
    const totals = new Map<string, number>();
    let peak = 0;
    for (const [iso, list] of chargesByDay.entries()) {
      const t = list.reduce((acc, a) => acc + a.monthly_cents, 0);
      totals.set(iso, t);
      if (t > peak) peak = t;
    }
    return { totalsByDay: totals, peakCents: peak };
  }, [chargesByDay]);

  // Build the month agenda (only IN-month days that have charges,
  // sorted by date asc).
  const monthAgenda = useMemo(() => {
    const out: { iso: string; date: Date; items: ActionItem[] }[] = [];
    for (const cell of grid) {
      if (!cell.inMonth) continue;
      const iso = isoDate(cell.date);
      const items = chargesByDay.get(iso);
      if (items && items.length > 0) {
        out.push({ iso, date: cell.date, items });
      }
    }
    return out;
  }, [grid, chargesByDay]);

  // Selected day — defaults to the URL param OR today (if today is in
  // this month) OR the first day with charges OR the 1st.
  const initial = (() => {
    if (initialSelectedIso) return initialSelectedIso;
    if (today.getFullYear() === year && today.getMonth() === month) {
      return isoDate(today);
    }
    if (monthAgenda.length > 0) return monthAgenda[0].iso;
    return isoDate(new Date(year, month, 1));
  })();
  const [selectedIso, setSelectedIso] = useState<string>(initial);

  // Smooth-scroll the agenda group into view when the user taps a day.
  // We also briefly highlight the target group via the highlightedIso
  // state (cleared after 1.2s) so the link reads visually.
  const [highlightedIso, setHighlightedIso] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDayClick = (iso: string) => {
    setSelectedIso(iso);
    // Only scroll if that day actually has an agenda entry.
    if (!chargesByDay.has(iso)) return;
    const el = document.getElementById(dayAnchorId(iso));
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightedIso(iso);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedIso(null), 1400);
  };

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  return (
    <div>
      {/* ─── Grid card ───────────────────────────────────────
          Capped width on desktop so the calendar reads as a widget,
          not a screen takeover. Centered, with normal whitespace
          around it. */}
      <div className="rounded-2xl border border-hairline bg-white shadow-soft p-3 md:p-5 max-w-[620px] mx-auto">
        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 mb-2 px-0.5">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-muted"
            >
              {w.slice(0, 1)}
              <span className="hidden md:inline">{w.slice(1)}</span>
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1 md:gap-1.5">
          {grid.map(({ date, inMonth }, i) => {
            const iso = isoDate(date);
            const charges = chargesByDay.get(iso) ?? [];
            const isToday = sameDay(date, today);
            const isSelected = iso === selectedIso;
            const total = totalsByDay.get(iso) ?? 0;
            // Heat ramp 0..0.18 alpha on the cell background based on
            // dollar magnitude relative to the month's peak.
            const heat = peakCents > 0 ? total / peakCents : 0;
            const heatAlpha = inMonth && total > 0 ? 0.06 + heat * 0.18 : 0;
            const bg =
              heatAlpha > 0
                ? `rgba(15, 110, 86, ${heatAlpha.toFixed(3)})`
                : undefined;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDayClick(iso)}
                disabled={!inMonth && charges.length === 0}
                className={[
                  "relative aspect-square md:aspect-[1.1/1] max-h-[72px] rounded-xl flex flex-col items-center justify-between p-1.5 transition-all",
                  inMonth ? "text-ink" : "text-ink-muted/40",
                  inMonth && !isSelected ? "hover:bg-ink/[0.04]" : "",
                  isSelected
                    ? "ring-2 ring-emerald-700 ring-offset-1 ring-offset-white"
                    : "",
                  inMonth && total > 0 && !isSelected
                    ? "hover:shadow-soft"
                    : "",
                ].join(" ")}
                style={bg ? { background: bg } : undefined}
                aria-label={`${date.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                })}${charges.length > 0 ? ` — ${charges.length} charge${charges.length === 1 ? "" : "s"}` : ""}`}
              >
                <span
                  className={[
                    "text-[13px] md:text-[14px] tabular-nums leading-none",
                    isToday
                      ? "font-bold inline-flex items-center justify-center w-6 h-6 rounded-full text-white"
                      : "font-medium",
                  ].join(" ")}
                  style={
                    isToday ? { background: "#0F6E56" } : undefined
                  }
                >
                  {date.getDate()}
                </span>
                {inMonth && total > 0 ? (
                  <span className="text-[9.5px] md:text-[10px] font-medium text-emerald-900/80 tabular-nums leading-none">
                    ${Math.round(total / 100).toLocaleString("en-US")}
                  </span>
                ) : (
                  <span className="block h-[10px]" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-between text-[10.5px] text-ink-muted px-0.5">
          <span>Tap a day to jump to its charges below</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-emerald-700/10" />
            <span className="inline-block w-2 h-2 rounded-sm bg-emerald-700/30" />
            heavier days
          </span>
        </div>
      </div>

      {/* ─── Month agenda ──────────────────────────────────── */}
      <div className="mt-7">
        <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted mb-2.5 px-1">
          This month, by day
        </div>
        {monthAgenda.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-white p-5 text-[13px] text-ink-muted">
            No charges expected this month.
          </div>
        ) : (
          <div className="space-y-3">
            {monthAgenda.map((group) => {
              const isHighlighted = highlightedIso === group.iso;
              const isSelectedGroup = selectedIso === group.iso;
              const dayLabel = group.date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const groupTotal = group.items.reduce(
                (acc, a) => acc + a.monthly_cents,
                0
              );
              return (
                <div
                  key={group.iso}
                  id={dayAnchorId(group.iso)}
                  className={[
                    "rounded-2xl border bg-white shadow-soft overflow-hidden transition-all",
                    isHighlighted
                      ? "border-emerald-300 ring-2 ring-emerald-200"
                      : isSelectedGroup
                        ? "border-emerald-200"
                        : "border-hairline",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-hairline/60 bg-canvas/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-900 shrink-0">
                        <span className="text-[9px] font-medium uppercase tracking-[0.05em] leading-none opacity-70">
                          {group.date.toLocaleDateString("en-US", {
                            month: "short",
                          })}
                        </span>
                        <span className="text-[14px] font-bold tabular-nums leading-none mt-0.5">
                          {group.date.getDate()}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-bold text-ink truncate">
                          {dayLabel}
                        </div>
                        <div className="text-[11.5px] text-ink-muted tabular-nums">
                          {group.items.length} charge
                          {group.items.length === 1 ? "" : "s"} · ~$
                          {Math.round(groupTotal / 100).toLocaleString("en-US")}
                        </div>
                      </div>
                    </div>
                  </div>
                  <ul className="divide-y divide-hairline/60">
                    {group.items.map((a) => (
                      <li key={a.subscription_id}>
                        <Link
                          href={`/app/subscriptions/${a.subscription_id}`}
                          className="flex items-center gap-3 px-4 md:px-5 py-3.5 hover:bg-canvas/40 transition"
                        >
                          <MerchantLogo
                            name={a.merchant_name}
                            domain={a.domain}
                            size={32}
                            rounded="lg"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="text-[14px] font-bold text-ink truncate">
                                {a.merchant_name}
                              </div>
                              {approximateIds?.has(a.subscription_id) ? (
                                <span
                                  className="inline-flex items-center rounded-full bg-ink/[0.05] text-ink-muted px-1.5 h-4 text-[9.5px] font-medium uppercase tracking-[0.06em] shrink-0"
                                  title="Estimated from billing history"
                                >
                                  est.
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[11.5px] text-ink-muted truncate">
                              {a.category.replace(/_/g, " ")}
                            </div>
                          </div>
                          <ConfidenceTierPill
                            probability={computeRenewalProbability(a)}
                          />
                          <div className="text-[13.5px] font-bold text-ink tabular-nums shrink-0">
                            ~$
                            {Math.round(a.monthly_cents / 100).toLocaleString(
                              "en-US"
                            )}
                          </div>
                          <ChevronRight
                            size={14}
                            strokeWidth={2}
                            className="text-ink-muted shrink-0"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[11px] text-ink-muted px-1 leading-relaxed">
          Forecast, not guaranteed. Predicted dates can shift when
          merchants change billing cycles.
        </p>
      </div>
    </div>
  );
}

// ─── confidence derivation ──────────────────────────────────────

// Real per-prediction probability derived from FOUR engine signals
// already on the ActionItem. See lib/selectors/dashboard.ts.
//
//   base       = a.confidence ?? 0.5
//   stability  = min(1, months_observed / 6)
//   freqPenalty = a.frequency === 'unknown' ? 0.4 : 1.0
//   statusPenalty = a.status === 'active' ? 1.0 : 0.3
//   probability = base * stability * freqPenalty * statusPenalty
//
// Tier boundaries: ≥0.80 high, ≥0.55 medium, <0.55 low.
//
// No invented numbers — all four inputs come from the engine.

export function computeRenewalProbability(a: ActionItem): number {
  const base =
    a.confidence !== null && a.confidence !== undefined ? a.confidence : 0.5;
  const months = a.months_observed ?? 0;
  const stability = Math.min(1, months / 6);
  const freqPenalty = a.frequency === "unknown" ? 0.4 : 1.0;
  const statusPenalty = a.status === "active" ? 1.0 : 0.3;
  return Math.max(
    0,
    Math.min(1, base * stability * freqPenalty * statusPenalty)
  );
}

function probabilityToTier(p: number): "high" | "medium" | "low" {
  if (p >= 0.8) return "high";
  if (p >= 0.55) return "medium";
  return "low";
}

function ConfidenceTierPill({
  probability,
}: {
  probability: number;
}) {
  const tier = probabilityToTier(probability);
  const cls =
    tier === "high"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : tier === "medium"
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : "bg-ink/[0.05] text-ink-muted border-hairline";
  const label =
    tier === "high"
      ? "Very likely"
      : tier === "medium"
        ? "Likely"
        : "Less certain";
  const pct = Math.round(probability * 100);
  return (
    <span
      className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-2 h-5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${cls}`}
    >
      {label}
      <span className="opacity-70 tabular-nums normal-case tracking-normal">
        · {pct}%
      </span>
    </span>
  );
}
