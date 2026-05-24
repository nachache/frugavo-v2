// Money-leak detection. Hidden-spend signals derived from the
// canonical ledger.
//
// All detectors are pure functions over (subscriptions, charges,
// asOf). No AI calls. Each leak carries a stable id and the source
// rows that produced it so the UI can show "here's why" receipts.
//
// Designed to power the "Hidden money leak" insight cards without
// any of the heuristic-feeling claims the user explicitly wanted to
// avoid. Every claim is a thing we can point to in the ledger.

import {
  isAiSubscription,
  monthlyEqCents,
  type LedgerCharge,
  type LedgerSubscription,
} from "./insights";
import {
  isHeroSubscription,
  type TieredSubscription,
} from "./selectors/surface-rules";

// Money leaks should only fire on subscriptions, never on bills or
// commerce. "Your gas station is dormant" or "your utility had a
// price increase" would feel broken — those are expected behaviors,
// not leaks. Bills get a separate alerts surface (billing-due).
function asTiered(s: LedgerSubscription): TieredSubscription & LedgerSubscription {
  return {
    ...s,
    recurring_type: s.recurring_type ?? "uncertain_recurring",
    confidence_score: s.confidence_score ?? 0,
  };
}
function filterToHeroSubs(subs: LedgerSubscription[]): LedgerSubscription[] {
  return subs.map(asTiered).filter(isHeroSubscription);
}

export type MoneyLeak = {
  id: string;
  kind:
    | "overlapping_ai_tools"
    | "dormant_subscription"
    | "price_creep"
    | "rising_monthly_spend";
  headline: string;
  detail: string;
  severity: "low" | "medium" | "high";
  source: {
    subscription_ids?: string[];
    cycle_from?: number;
    cycle_to?: number;
    amount_from_cents?: number;
    amount_to_cents?: number;
    last_charge_date?: string;
  };
};

function fmtCents(c: number): string {
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

function pct(a: number, b: number): number {
  if (b <= 0) return 0;
  return a / b;
}

// ---------------------------------------------------------------------------
// 1. Overlapping AI tools.
//
// "You pay for N overlapping AI tools." Only counts confirmed-active
// AI subs. Threshold is 3+ because 2 tools is normal (chat + image,
// chat + IDE), 3 starts to feel duplicative.
// ---------------------------------------------------------------------------

export function detectOverlappingAi(
  subs: LedgerSubscription[]
): MoneyLeak | null {
  const aiActive = subs.filter(
    (s) =>
      isAiSubscription(s) &&
      s.status === "active" &&
      s.classification === "confirmed"
  );
  if (aiActive.length < 3) return null;
  const totalMonthly = aiActive.reduce(
    (acc, s) => acc + monthlyEqCents(s.amount_cents, s.frequency),
    0
  );
  return {
    id: "overlapping_ai_tools",
    kind: "overlapping_ai_tools",
    headline: `You pay for ${aiActive.length} overlapping AI tools.`,
    detail: `${aiActive
      .map((s) => s.merchant_name)
      .join(", ")} — ${fmtCents(totalMonthly)}/mo combined.`,
    severity: aiActive.length >= 5 ? "high" : "medium",
    source: {
      subscription_ids: aiActive.map((s) => s.id),
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Dormant subscriptions.
//
// Subscription is marked active but its last accepted charge was more
// than 90 days ago. Plaid may not have synced a fresh charge yet, or
// the user paused / cancelled and the engine hasn't tombstoned it.
// Either way, surfaces a "did you forget about this?" moment.
// ---------------------------------------------------------------------------

export function detectDormant(
  subs: LedgerSubscription[],
  charges: LedgerCharge[],
  asOf: Date
): MoneyLeak[] {
  const out: MoneyLeak[] = [];
  const ninetyDaysAgo = new Date(asOf);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffIso = ninetyDaysAgo.toISOString().slice(0, 10);

  // Build last-charge-date map.
  const lastChargeBySub = new Map<string, string>();
  for (const c of charges) {
    if (c.detector_status !== "accepted") continue;
    const prev = lastChargeBySub.get(c.subscription_id);
    if (!prev || c.posted_date > prev) {
      lastChargeBySub.set(c.subscription_id, c.posted_date);
    }
  }

  for (const s of subs) {
    if (s.status !== "active" || s.classification !== "confirmed") continue;
    const last = lastChargeBySub.get(s.id);
    if (!last) continue; // Never charged in ledger — skip; not enough signal.
    if (last >= cutoffIso) continue;
    const monthly = monthlyEqCents(s.amount_cents, s.frequency);
    out.push({
      id: `dormant_${s.id}`,
      kind: "dormant_subscription",
      headline: `${s.merchant_name} hasn't charged you in 90+ days.`,
      detail: `Last charge ${last}. Still listed as active at ${fmtCents(monthly)}/mo.`,
      severity: "medium",
      source: {
        subscription_ids: [s.id],
        last_charge_date: last,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Price creep.
//
// Compares the earliest accepted-charge amount on a subscription to
// the latest one. Flags if the latest is >= 10% higher than the
// earliest AND at least 3 accepted cycles exist (so we're not
// reacting to noise on a 2-charge series).
// ---------------------------------------------------------------------------

export function detectPriceCreep(
  subs: LedgerSubscription[],
  charges: LedgerCharge[]
): MoneyLeak[] {
  const bySub = new Map<string, LedgerCharge[]>();
  for (const c of charges) {
    if (c.detector_status !== "accepted") continue;
    const arr = bySub.get(c.subscription_id) ?? [];
    arr.push(c);
    bySub.set(c.subscription_id, arr);
  }

  const out: MoneyLeak[] = [];
  for (const s of subs) {
    if (s.status !== "active" || s.classification !== "confirmed") continue;
    const arr = bySub.get(s.id);
    if (!arr || arr.length < 3) continue;
    const sorted = [...arr].sort((a, b) =>
      (a.cadence_cycle_id ?? 0) - (b.cadence_cycle_id ?? 0)
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first.amount_cents <= 0) continue;
    const delta = pct(last.amount_cents - first.amount_cents, first.amount_cents);
    if (delta < 0.1) continue;
    out.push({
      id: `price_creep_${s.id}`,
      kind: "price_creep",
      headline: `${s.merchant_name} increased ${Math.round(delta * 100)}%.`,
      detail: `${fmtCents(first.amount_cents)} → ${fmtCents(last.amount_cents)} over ${sorted.length} cycles.`,
      severity: delta >= 0.25 ? "high" : "medium",
      source: {
        subscription_ids: [s.id],
        cycle_from: first.cadence_cycle_id ?? undefined,
        cycle_to: last.cadence_cycle_id ?? undefined,
        amount_from_cents: first.amount_cents,
        amount_to_cents: last.amount_cents,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Rising monthly spend.
//
// Three-month rolling: latest 3-month average vs the 3-month period
// six months prior. If the latest is meaningfully higher (15%+),
// surface the trend. This complements per-subscription price creep
// by catching the case where each individual sub barely moved but the
// stack grew (new subs were added).
// ---------------------------------------------------------------------------

export function detectRisingTotalSpend(
  charges: LedgerCharge[],
  asOf: Date
): MoneyLeak | null {
  const buckets = new Map<string, number>();
  for (const c of charges) {
    if (c.detector_status !== "accepted") continue;
    const m = c.posted_date.slice(0, 7);
    buckets.set(m, (buckets.get(m) ?? 0) + c.amount_cents);
  }

  // Build descending-month list.
  const ordered: string[] = [];
  for (let i = 0; i < 9; i++) {
    const d = new Date(asOf);
    d.setMonth(d.getMonth() - i);
    ordered.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }
  if (ordered.length < 9) return null;

  const recent3 = ordered.slice(0, 3); // last 3 months including current
  const prior3 = ordered.slice(6, 9); // 3 months from 6-8 months ago

  const recentTotal = recent3.reduce((a, m) => a + (buckets.get(m) ?? 0), 0);
  const priorTotal = prior3.reduce((a, m) => a + (buckets.get(m) ?? 0), 0);
  if (priorTotal <= 0) return null;
  const delta = pct(recentTotal - priorTotal, priorTotal);
  if (delta < 0.15) return null;

  return {
    id: "rising_monthly_spend",
    kind: "rising_monthly_spend",
    headline: `Your subscription spend is up ${Math.round(delta * 100)}% from 6 months ago.`,
    detail: `${fmtCents(Math.round(priorTotal / 3))}/mo average then, ${fmtCents(Math.round(recentTotal / 3))}/mo now.`,
    severity: delta >= 0.4 ? "high" : "medium",
    source: {
      // No subscription_ids — this is an aggregate signal. Months
      // listed for receipt purposes.
    },
  };
}

// ---------------------------------------------------------------------------
// Compose all leaks into one ordered list.
// ---------------------------------------------------------------------------

export function computeMoneyLeaks(args: {
  subs: LedgerSubscription[];
  charges: LedgerCharge[];
  asOf: Date;
}): MoneyLeak[] {
  // FILTER BEFORE AGGREGATE. The downstream detectors all assume
  // their input is the subscription pool (so "dormant" / "price
  // creep" / "overlapping AI" make sense). Bills, commerce, and
  // uncertain are filtered out here once, and every detector reads
  // from the same clean slice.
  const heroSubs = filterToHeroSubs(args.subs);
  const out: MoneyLeak[] = [];
  const overlap = detectOverlappingAi(heroSubs);
  if (overlap) out.push(overlap);
  out.push(...detectDormant(heroSubs, args.charges, args.asOf));
  out.push(...detectPriceCreep(heroSubs, args.charges));
  const rising = detectRisingTotalSpend(args.charges, args.asOf);
  if (rising) out.push(rising);

  // Sort severity high → low so the most useful card comes first.
  const sev = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((a, b) => sev[a.severity] - sev[b.severity]);
}
