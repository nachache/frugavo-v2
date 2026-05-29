"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ActionItem } from "@/lib/selectors/dashboard";

// RenewalsCalendar — full-month grid + day agenda.
//
// Pure CSS grid + date math. No date-picker dependency per spec.
//
// Day cells: 7 columns Sun–Sat. Leading/trailing days from the
// adjacent months are dimmed but rendered so the grid is always
// 5 or 6 rows tall — never ragged.
//
// Today is marked with a small filled ring. Selected day is marked
// with a heavier outline. Days with predicted charges get a small
// brand-green dot + count.
//
// Tapping a day reveals that day's agenda BELOW the grid as a list
// of charge rows, each with merchant, amount, and confidence pill.
// Tapping a charge routes to /app/subscriptions/[id].

type Props = {
  year: number;
  month: number; // 0..11
  upcoming: ActionItem[];
  initialSelectedIso: string | null;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

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

export function RenewalsCalendar({
  year,
  month,
  upcoming,
  initialSelectedIso,
}: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Build the grid: start on the Sunday of the week containing the
  // 1st, end on the Saturday of the week containing the last day.
  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startOffset = first.getDay(); // 0 = Sun
    const endPad = 6 - last.getDay();
    const total = startOffset + last.getDate() + endPad;
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(year, month, 1 - startOffset + i);
      cells.push({ date: d, inMonth: d.getMonth() === month });
    }
    return cells;
  }, [year, month]);

  // Index charges by ISO day for quick lookup.
  const chargesByDay = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const a of upcoming) {
      if (!a.next_expected_charge_at) continue;
      const iso = a.next_expected_charge_at.slice(0, 10);
      const list = map.get(iso) ?? [];
      list.push(a);
      map.set(iso, list);
    }
    return map;
  }, [upcoming]);

  // Selected day state — defaults to the URL param OR today (if today
  // falls in this month), else the 1st of the month.
  const initial = (() => {
    if (initialSelectedIso) return initialSelectedIso;
    if (today.getFullYear() === year && today.getMonth() === month) {
      return isoDate(today);
    }
    return isoDate(new Date(year, month, 1));
  })();
  const [selectedIso, setSelectedIso] = useState<string>(initial);

  const agendaCharges = chargesByDay.get(selectedIso) ?? [];
  const selectedDate = new Date(selectedIso);
  const selectedLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-2 px-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="text-center text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-muted"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }, i) => {
          const iso = isoDate(date);
          const charges = chargesByDay.get(iso) ?? [];
          const isToday = sameDay(date, today);
          const isSelected = iso === selectedIso;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedIso(iso)}
              className={[
                "relative aspect-square rounded-xl flex flex-col items-center justify-center transition-colors",
                inMonth
                  ? "text-ink hover:bg-ink/[0.04]"
                  : "text-ink-muted/40 hover:bg-ink/[0.02]",
                isSelected ? "ring-2 ring-emerald-600 ring-offset-1" : "",
              ].join(" ")}
              aria-label={`Renewals on ${date.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}`}
            >
              <span
                className={[
                  "text-[13px] tabular-nums",
                  isToday
                    ? "font-medium inline-flex items-center justify-center w-6 h-6 rounded-full bg-ink text-white"
                    : "",
                ].join(" ")}
              >
                {date.getDate()}
              </span>
              {charges.length > 0 && inMonth ? (
                <span className="absolute bottom-1.5 inline-flex items-center gap-0.5">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: "#0F6E56" }}
                  />
                  {charges.length > 1 ? (
                    <span className="text-[9.5px] font-medium text-ink-muted leading-none">
                      {charges.length}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Agenda for the selected day */}
      <div className="mt-7">
        <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted mb-2.5 px-1">
          {selectedLabel}
        </div>
        {agendaCharges.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-white p-5 text-[13px] text-ink-muted">
            No charges expected on this day.
          </div>
        ) : (
          <ul className="rounded-2xl border border-hairline bg-white divide-y divide-hairline/60 overflow-hidden">
            {agendaCharges.map((a) => (
              <li key={a.subscription_id}>
                <Link
                  href={`/app/subscriptions/${a.subscription_id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas/40 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-ink truncate">
                      {a.merchant_name}
                    </div>
                    <div className="text-[12px] text-ink-muted">
                      {a.category.replace(/_/g, " ")}
                    </div>
                  </div>
                  <ConfidenceTierPill
                    tier={deriveRenewalConfidenceTier(a)}
                  />
                  <div className="text-[13px] font-medium text-ink tabular-nums shrink-0">
                    ~$
                    {Math.round(a.monthly_cents / 100).toLocaleString("en-US")}
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

// Three-tier label per spec. Derived from REAL engine signals:
//   • months_observed — how many distinct months have a charge for
//     this sub (max 12). More observation = more stable prediction.
//   • implicit cadence regularity — if frequency is 'unknown' or
//     status != 'active', we drop to Low.
//
// TODO(confidence): when the engine ships a per-prediction temporal
//   score (e.g. probability density that charge X lands on date Y),
//   replace this tier mapping with the real percent and surface it
//   inline. Until then we keep tiers per the confidence-honesty rule.
function deriveRenewalConfidenceTier(
  a: ActionItem
): "high" | "medium" | "low" {
  if (a.status !== "active" || a.frequency === "unknown") return "low";
  const months = a.months_observed ?? 0;
  if (months >= 6) return "high";
  if (months >= 3) return "medium";
  return "low";
}

function ConfidenceTierPill({
  tier,
}: {
  tier: "high" | "medium" | "low";
}) {
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
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 h-5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${cls}`}
    >
      {label}
    </span>
  );
}
