// Real-bank-data ingestion path for sandbox testing.
//
// THIS FILE CONTAINS THE ONLY HUMAN-WRITTEN RULES APPLIED TO YOUR DATA.
// Everything else in the pipeline (filter, AI normalize, category
// assignment, regret score, candidate detection, dashboard rendering)
// is the production code path with no per-merchant overrides.
//
// What we DO:
//   - Read tests/fixtures/raw-transactions.json (every row of your xlsx,
//     unmodified — see scripts/extract-transactions.py for the export).
//   - Filter to outflows (amount < 0). Plaid's recurring detector only
//     considers outflows for subscription detection.
//   - Group transactions by the bank's `descriptor` field, byte-for-byte
//     equal. No casing, whitespace, or punctuation normalization.
//   - For each group, decide if it qualifies as a recurring stream using
//     the single rule below.
//
// What we DO NOT do:
//   - Re-anchor dates. Original 2024-2025 dates are preserved.
//   - Clean merchant names. The raw descriptor goes straight to the AI
//     normalizer (lib/ai/normalize.ts) which is the product surface
//     responsible for that step.
//   - Pre-assign categories. The AI normalizer assigns them; null until
//     it does.
//   - Drop "noise" descriptors. Credit-card auto-pays, transfers, etc.
//     are caught downstream by lib/scan.ts → isProbablySubscription().
//     That filter is product code, and dropping things here would hide
//     bugs in it.
//   - Hand-write any plaid_merchant_name. Always null. The AI handles it.
//
// THE ONE RULE — recurrence detection
//
//   A descriptor becomes a recurring stream IFF:
//     occurrences          >= 3
//     median gap (days)    in [5, 45]
//
// That's it. Plaid's internal detector uses something close to this
// (with a few additional signals around amount variance and merchant
// quality). We deliberately use the simpler version so behavior is
// reproducible and auditable. Adjust the constants below if you want
// to test under different assumptions.

import rawTransactions from "@/tests/fixtures/raw-transactions.json";

const MIN_OCCURRENCES = 3;
const MIN_MEDIAN_GAP_DAYS = 5;
const MAX_MEDIAN_GAP_DAYS = 45;

export type RawTxn = {
  date: string;        // "YYYY-MM-DD"
  type: string;        // bank's transaction-type label, unused downstream
  descriptor: string;  // bank's merchant string, passed straight to AI
  amount_dollars: number; // signed: negative = outflow
};

export type RawDetectedStream = {
  stream_id: string;
  descriptor: string;
  occurrences: number;
  median_gap_days: number;
  frequency: string;       // Plaid enum: WEEKLY | BIWEEKLY | SEMI_MONTHLY | MONTHLY
  average_amount: number;  // positive dollars
  last_date: string;       // "YYYY-MM-DD"
  next_expected_date: string; // last_date + median_gap_days; mirrors Plaid's field
  transactions: RawTxn[];  // every original charge, preserved
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

// Maps an observed median spacing to Plaid's frequency enum. Mirrors
// the buckets Plaid uses internally so the rest of the pipeline reads
// the values the same way it would in production.
function mapFrequency(medianGapDays: number): string {
  if (medianGapDays <= 9) return "WEEKLY";
  if (medianGapDays <= 18) return "BIWEEKLY";
  if (medianGapDays <= 22) return "SEMI_MONTHLY";
  return "MONTHLY";
}

// Stable, URL-safe stream id derived from the descriptor. Same
// descriptor across runs yields the same id, so re-imports upsert
// into the same subscriptions row.
function streamIdFor(descriptor: string): string {
  const safe = descriptor
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return `raw-${safe || "anonymous"}`;
}

export function recurringStreamsFromRaw(): RawDetectedStream[] {
  const all = rawTransactions as RawTxn[];
  const outflows = all.filter((t) => t.amount_dollars < 0);

  // Group by exact descriptor.
  const groups = new Map<string, RawTxn[]>();
  for (const t of outflows) {
    const arr = groups.get(t.descriptor) ?? [];
    arr.push(t);
    groups.set(t.descriptor, arr);
  }

  const streams: RawDetectedStream[] = [];
  for (const [descriptor, items] of groups) {
    if (items.length < MIN_OCCURRENCES) continue;

    items.sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < items.length; i++) {
      gaps.push(daysBetween(items[i - 1].date, items[i].date));
    }
    const medianGap = median(gaps);
    if (medianGap < MIN_MEDIAN_GAP_DAYS) continue;
    if (medianGap > MAX_MEDIAN_GAP_DAYS) continue;

    const avg =
      items.reduce((s, t) => s + Math.abs(t.amount_dollars), 0) / items.length;

    streams.push({
      stream_id: streamIdFor(descriptor),
      descriptor,
      occurrences: items.length,
      median_gap_days: medianGap,
      frequency: mapFrequency(medianGap),
      average_amount: avg,
      last_date: items[items.length - 1].date,
      next_expected_date: addDays(items[items.length - 1].date, medianGap),
      transactions: items,
    });
  }

  // Stable ordering for reproducibility.
  streams.sort((a, b) => b.average_amount - a.average_amount);
  return streams;
}

// Number of unique outflow descriptors, including non-recurring. Useful
// for the "scanned N transactions" trust receipt at the end of a scan.
export function totalOutflowCount(): number {
  return (rawTransactions as RawTxn[]).filter(
    (t) => t.amount_dollars < 0
  ).length;
}
