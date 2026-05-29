"use client";

// Renewing soon — dedicated card for upcoming recurring charges.
//
// Why its own surface:
//   The WhatChangedCard handles things that already happened
//   (new subs, price changes). Forecasted renewals are a different
//   tense — they're predictions about what's about to happen, and
//   mixing them into "what changed" made both harder to parse.
//
// Language rules:
//   - NEVER say "will charge on Mar 15" — predictions drift if
//     the merchant shifts a billing day or the bank takes longer
//     to post.
//   - DO say "renews in ~N days" or "expected around Mar 15" so
//     the user understands this is an estimate.
//
// Inputs come straight from the dashboard ActionItem payload —
// each item already carries next_expected_charge_at when the engine
// has a confident enough cadence to predict one.

import Link from "next/link";
import { MerchantLogo } from "./merchant-logo";
import type { ActionItem } from "@/lib/selectors/dashboard";

type Props = {
  items: ActionItem[];
};

const LOOKAHEAD_DAYS = 14;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtAmount(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

function fmtSoftDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Returns a calm, predictive label — never a hard guarantee.
//   < 0 days  → already due / overdue
//   0 days    → "expected today"
//   1 day     → "expected tomorrow"
//   2..14     → "in ~N days"
function renewalLabel(daysOut: number): string {
  if (daysOut < 0) return "Overdue prediction";
  if (daysOut === 0) return "Expected today";
  if (daysOut === 1) return "Expected tomorrow";
  return `Expected in ~${daysOut} days`;
}

export function RenewingSoonCard({ items }: Props) {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + LOOKAHEAD_DAYS);

  // Take items with a forecast date inside the window, sort by
  // soonest. Cap at 5 — the section is a glanceable preview, not
  // a full calendar.
  const enriched = items
    .filter(
      (it): it is ActionItem & { next_expected_charge_at: string } =>
        !!it.next_expected_charge_at &&
        it.override_type !== "cancelled" &&
        it.override_type !== "not_subscription" &&
        it.override_type !== "not_recurring"
    )
    .map((it) => {
      const d = new Date(it.next_expected_charge_at);
      const days = daysBetween(now, d);
      return { item: it, date: d, days };
    })
    .filter((e) => e.days >= -3 && e.days <= LOOKAHEAD_DAYS)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  if (enriched.length === 0) return null;

  const totalCents = enriched.reduce(
    (acc, e) => acc + e.item.monthly_cents,
    0
  );

  return (
    <div
      className="card-window rounded-2xl border border-hairline bg-surface p-4 md:p-7 animate-fadeUp"
      style={{ animationDelay: "0.04s" }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Renewing soon
          </div>
          <div className="mt-1 text-[13px] md:text-[14px] text-ink-body">
            {enriched.length}{" "}
            {enriched.length === 1 ? "charge" : "charges"} expected in the
            next {LOOKAHEAD_DAYS} days · forecast, not guaranteed
          </div>
        </div>
        <div className="text-right">
          <div className="font-display font-bold text-[24px] md:text-[28px] tracking-[-0.02em] tabular-nums leading-none text-ink">
            ~{fmtAmount(totalCents)}
          </div>
          <div className="mt-1 text-[11px] md:text-[12px] text-ink-muted">
            estimated total
          </div>
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {enriched.map(({ item, date, days }) => (
          <li key={item.subscription_id}>
            <Link
              href={`/app/subscriptions/${item.subscription_id}`}
              className="flex items-center gap-3 rounded-xl bg-canvas/40 px-3 py-3 md:px-4 md:py-3.5 hover:bg-canvas/70 transition group"
            >
              <MerchantLogo
                name={item.merchant_name}
                domain={item.domain}
                size={28}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] md:text-[15px] font-medium text-ink truncate group-hover:underline decoration-ink/30 underline-offset-2">
                  {item.merchant_name}
                </div>
                <div className="text-[12px] md:text-[13px] text-ink-muted">
                  {renewalLabel(days)} · ~{fmtSoftDate(date.toISOString())}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[14px] md:text-[15px] font-medium tabular-nums text-ink">
                  ~{fmtAmount(item.monthly_cents)}
                </div>
                <div className="text-[11px] text-ink-muted">expected</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
