// Real-bank-data ingestion path for sandbox testing.
//
// THIS FILE CONTAINS THE ONLY HUMAN-WRITTEN RULES APPLIED TO YOUR DATA.
// Everything else in the pipeline (filter, normalize, category
// assignment, regret score, candidate detection, dashboard rendering)
// is the production code path with no per-merchant overrides.
//
// What we DO:
//   - Read tests/fixtures/raw-transactions.json (every row of the xlsx,
//     unmodified — see scripts/extract-transactions.py for the export).
//   - Filter to outflows (amount < 0). Subscriptions are outflows.
//   - Group transactions by NORMALIZED descriptor (lib/merchant-normalize)
//     so charges from the same merchant cluster even when bank descriptor
//     formatting differs charge-to-charge (account numbers, store codes,
//     order IDs change; merchant identity does not).
//   - Within each group, decide if it qualifies as a recurring stream
//     using the cadence + amount-drift rules below.
//
// What we DO NOT do:
//   - Re-anchor dates. Original 2024-2025 dates are preserved.
//   - Hand-curate merchant lists here. The merchant catalog lives in
//     lib/data/merchant-catalog.json as a maintained product asset.
//   - Pre-assign categories. The catalog supplies categories; nothing
//     in this file picks a category.
//
// --- RULES ---
//
// 1. Recurrence cadence (median inter-charge gap in days):
//      WEEKLY       4–9
//      BIWEEKLY     10–18
//      SEMI_MONTHLY 19–22
//      MONTHLY      23–45
//      QUARTERLY    80–100
//      ANNUALLY     330–400
//    Anything outside these bands is dropped.
//    Justification: empirically the most common subscription cadences.
//    Bands are wide enough to absorb weekend/month-end posting drift and
//    leap-year noise (Feb 28 vs Feb 29 shifts the median by half a day).
//
// 2. Minimum occurrences = 3.
//    Justification: two charges could be coincidence (a user ordering
//    pizza twice at the same place); three consistent charges is the
//    weakest signal that reliably distinguishes recurrence from
//    repetition. Lower would inflate false positives; higher would
//    miss new annual subs until their fourth year.
//
// 3. Amount drift tolerance:
//      Default            ±15% of median
//      Non-USD / FX       ±25% of median
//    Charges outside the tolerance are excluded from the group BEFORE
//    occurrences are counted. This catches FX-billed subs that drift
//    with the exchange rate without splitting them into separate
//    groups every time the rate moves.
//    Justification: 15% covers ordinary price increases, taxes that
//    fluctuate per-period, and rounding by App Store / Google Play.
//    The FX widening accounts for ~20% peak-to-trough swings on most
//    crosses over a 12-month window.

import rawTransactions from "@/tests/fixtures/raw-transactions.json";
import { normalizeDescriptor } from "./merchant-normalize";

const MIN_OCCURRENCES = 3;

// Cadence bands (inclusive lower, inclusive upper).
const CADENCE_BANDS: { name: string; min: number; max: number }[] = [
  { name: "WEEKLY", min: 4, max: 9 },
  { name: "BIWEEKLY", min: 10, max: 18 },
  { name: "SEMI_MONTHLY", min: 19, max: 22 },
  { name: "MONTHLY", min: 23, max: 45 },
  { name: "QUARTERLY", min: 80, max: 100 },
  { name: "ANNUALLY", min: 330, max: 400 },
];

const DEFAULT_AMOUNT_DRIFT = 0.15;
const FX_AMOUNT_DRIFT = 0.25;

export type RawTxn = {
  date: string;
  type: string;
  descriptor: string;
  amount_dollars: number;
  currency?: string;
};

export type RawDetectedStream = {
  stream_id: string;
  descriptor: string;          // representative original descriptor
  normalized_merchant: string; // catalog display or fallback
  occurrences: number;
  median_gap_days: number;
  frequency: string;
  average_amount: number;
  last_date: string;
  next_expected_date: string;
  transactions: RawTxn[];
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  );
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function bandFor(gap: number): string | null {
  for (const b of CADENCE_BANDS) {
    if (gap >= b.min && gap <= b.max) return b.name;
  }
  return null;
}

// Stable, URL-safe stream id from a normalized key + canonical descriptor.
// Same merchant across runs yields the same id, so re-imports upsert
// into the same subscriptions row.
function streamIdFor(key: string): string {
  const safe = key
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return `raw-${safe || "anonymous"}`;
}

// Filter a group down to charges whose amount is within tolerance of
// the group median. Returns the filtered list and the median.
function applyDriftTolerance(
  items: RawTxn[]
): { kept: RawTxn[]; median: number } {
  if (items.length === 0) return { kept: [], median: 0 };
  const amounts = items.map((t) => Math.abs(t.amount_dollars));
  const med = median(amounts);
  if (med === 0) return { kept: items, median: 0 };

  // Pick a tolerance per item. If a charge's currency is non-USD (or
  // unknown but flagged in some downstream way), use the wider FX band.
  const kept = items.filter((t) => {
    const tol =
      t.currency && t.currency.toUpperCase() !== "USD"
        ? FX_AMOUNT_DRIFT
        : DEFAULT_AMOUNT_DRIFT;
    const diff = Math.abs(Math.abs(t.amount_dollars) - med) / med;
    return diff <= tol;
  });

  return { kept, median: med };
}

export function recurringStreamsFromRaw(): RawDetectedStream[] {
  const all = rawTransactions as RawTxn[];
  const outflows = all.filter((t) => t.amount_dollars < 0);

  // Group by NORMALIZED merchant key, falling back to lowercased
  // descriptor when normalization yields no catalog match. This is
  // what gives us "Adobe systems #4421" + "Adobe systems #4422" +
  // "ADBE*creative" all clustering into one stream.
  const groups = new Map<string, { key: string; items: RawTxn[]; rep: string }>();
  for (const t of outflows) {
    const norm = normalizeDescriptor(t.descriptor);
    const key = norm.catalog_key ?? norm.merchant_name.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(t);
    } else {
      groups.set(key, { key, items: [t], rep: t.descriptor });
    }
  }

  const streams: RawDetectedStream[] = [];
  for (const { key, items: rawItems, rep } of groups.values()) {
    if (rawItems.length < MIN_OCCURRENCES) continue;

    // Drift tolerance: exclude outlier amounts from the recurrence
    // calculation. A $200 ad-hoc charge in a stream of $9.99 Spotify
    // payments should not throw off the median gap.
    const { kept: driftKept, median: medAmount } = applyDriftTolerance(rawItems);
    if (driftKept.length < MIN_OCCURRENCES) continue;

    driftKept.sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < driftKept.length; i++) {
      gaps.push(daysBetween(driftKept[i - 1].date, driftKept[i].date));
    }
    const medianGap = median(gaps);
    const band = bandFor(medianGap);
    if (!band) continue;

    const norm = normalizeDescriptor(rep);

    streams.push({
      stream_id: streamIdFor(key),
      descriptor: rep,
      normalized_merchant: norm.merchant_name,
      occurrences: driftKept.length,
      median_gap_days: medianGap,
      frequency: band,
      average_amount: medAmount,
      last_date: driftKept[driftKept.length - 1].date,
      next_expected_date: addDays(driftKept[driftKept.length - 1].date, medianGap),
      transactions: driftKept,
    });
  }

  // Deterministic ordering: by descriptor key (alphabetical). The scan
  // layer re-sorts for SSE / row order, but a stable ordering here means
  // any debug output is reproducible.
  streams.sort((a, b) => a.stream_id.localeCompare(b.stream_id));
  return streams;
}

export function totalOutflowCount(): number {
  return (rawTransactions as RawTxn[]).filter(
    (t) => t.amount_dollars < 0
  ).length;
}
