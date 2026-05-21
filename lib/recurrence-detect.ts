// Pure recurrence-detection engine.
//
// Takes an arbitrary array of transactions, returns the recurring
// streams. No I/O, no Plaid, no DB, no AI, no Date.now(). Same input
// + same parameters → byte-identical output.
//
// Used by:
//   - lib/raw-data-ingest.ts (sandbox demo path over xlsx fixture)
//   - lib/scan.ts (production path over plaid_transactions table)
//
// Both callers feed in the same TxnInput shape and consume the same
// DetectedStream output, so the engine is the single source of truth.
//
// Algorithm (mirrors the contract in the audit doc):
//
//   1. Filter to outflows (negative amounts).
//   2. Group by NORMALIZED merchant key. Caller is responsible for
//      attaching merchant_key (catalog → fuzzy fallback) to each txn
//      BEFORE calling this function. We trust whatever it computed.
//   3. Within each group, apply amount drift tolerance:
//        ±15% of group median (USD)
//        ±25% of group median (non-USD / FX)
//      Transactions outside tolerance are excluded from this group BUT
//      kept aside as "outliers" for the caller's audit log if it wants.
//   4. If the surviving group has < min_occurrences (default 3), drop.
//   5. Compute the median inter-charge gap in days, classify into a
//      cadence band:
//        WEEKLY        4–9
//        BIWEEKLY      10–18
//        SEMI_MONTHLY  19–22
//        MONTHLY       23–45
//        QUARTERLY     80–100
//        ANNUALLY      330–400
//   6. If outside every band, drop.
//   7. Output a DetectedStream per surviving group, sorted by
//      merchant_key for stable ordering.

export type TxnInput = {
  // Source identifier — Plaid transaction_id in production. Used to
  // dedupe inside a single group and to back-reference for charge
  // history rendering.
  txn_id: string;
  date: string; // "YYYY-MM-DD"
  amount_dollars: number; // negative = outflow
  currency: string; // "USD", "CAD", etc.
  raw_descriptor: string;
  // Caller-attached normalization output. The engine NEVER calls the
  // normalizer itself — that's the caller's job, and lets us swap
  // normalization strategies without touching detection.
  merchant_key: string;
  canonical_name: string;
  normalized_descriptor: string;
};

export type DetectedStream = {
  merchant_key: string;
  canonical_name: string;
  representative_descriptor: string;
  normalized_descriptor: string;
  occurrences: number;
  median_gap_days: number;
  frequency:
    | "WEEKLY"
    | "BIWEEKLY"
    | "SEMI_MONTHLY"
    | "MONTHLY"
    | "QUARTERLY"
    | "ANNUALLY";
  average_amount_dollars: number;
  median_amount_dollars: number;
  currency: string;
  last_date: string;
  next_expected_date: string;
  transactions: TxnInput[];
  outliers: TxnInput[]; // amount-drift-rejected charges, kept for audit
};

export type DetectorParams = {
  min_occurrences: number; // default 3
  drift_usd: number; // default 0.15
  drift_fx: number; // default 0.25
  cadence_bands: { name: DetectedStream["frequency"]; min: number; max: number }[];
};

export const DEFAULT_PARAMS: DetectorParams = {
  min_occurrences: 3,
  drift_usd: 0.15,
  drift_fx: 0.25,
  cadence_bands: [
    { name: "WEEKLY", min: 4, max: 9 },
    { name: "BIWEEKLY", min: 10, max: 18 },
    { name: "SEMI_MONTHLY", min: 19, max: 22 },
    { name: "MONTHLY", min: 23, max: 45 },
    { name: "QUARTERLY", min: 80, max: 100 },
    { name: "ANNUALLY", min: 330, max: 400 },
  ],
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

function bandFor(
  gap: number,
  bands: DetectorParams["cadence_bands"]
): DetectedStream["frequency"] | null {
  for (const b of bands) {
    if (gap >= b.min && gap <= b.max) return b.name;
  }
  return null;
}

export function detectRecurringStreams(
  txns: TxnInput[],
  params: DetectorParams = DEFAULT_PARAMS
): DetectedStream[] {
  // Step 1: outflows only.
  const outflows = txns.filter((t) => t.amount_dollars < 0);

  // Step 2: group by merchant_key.
  const groups = new Map<string, TxnInput[]>();
  for (const t of outflows) {
    const arr = groups.get(t.merchant_key) ?? [];
    arr.push(t);
    groups.set(t.merchant_key, arr);
  }

  const out: DetectedStream[] = [];

  for (const [key, items] of groups) {
    // Step 3: drift tolerance per item, against group median.
    const amounts = items.map((t) => Math.abs(t.amount_dollars));
    const medAmount = median(amounts);
    if (medAmount === 0) continue;

    const kept: TxnInput[] = [];
    const outliers: TxnInput[] = [];
    for (const t of items) {
      const tol =
        t.currency.toUpperCase() !== "USD" ? params.drift_fx : params.drift_usd;
      const diff = Math.abs(Math.abs(t.amount_dollars) - medAmount) / medAmount;
      if (diff <= tol) kept.push(t);
      else outliers.push(t);
    }

    // Step 4: min occurrences.
    if (kept.length < params.min_occurrences) continue;

    // Stable order by date — required for deterministic gap median.
    kept.sort((a, b) => a.date.localeCompare(b.date));

    // Step 5: cadence.
    const gaps: number[] = [];
    for (let i = 1; i < kept.length; i++) {
      gaps.push(daysBetween(kept[i - 1].date, kept[i].date));
    }
    const medianGap = median(gaps);
    const band = bandFor(medianGap, params.cadence_bands);
    if (!band) continue;

    const rep = kept[Math.floor(kept.length / 2)];
    const lastDate = kept[kept.length - 1].date;
    const avg =
      kept.reduce((s, t) => s + Math.abs(t.amount_dollars), 0) / kept.length;

    out.push({
      merchant_key: key,
      canonical_name: rep.canonical_name,
      representative_descriptor: rep.raw_descriptor,
      normalized_descriptor: rep.normalized_descriptor,
      occurrences: kept.length,
      median_gap_days: medianGap,
      frequency: band,
      average_amount_dollars: avg,
      median_amount_dollars: medAmount,
      currency: rep.currency,
      last_date: lastDate,
      next_expected_date: addDays(lastDate, medianGap),
      transactions: kept,
      outliers,
    });
  }

  // Deterministic ordering for reproducibility.
  out.sort((a, b) => a.merchant_key.localeCompare(b.merchant_key));
  return out;
}

// Convenience helper: map our cadence enum to the Frequency enum the
// scan module already uses.
export function cadenceToFrequency(
  cadence: DetectedStream["frequency"]
):
  | "weekly"
  | "biweekly"
  | "semi_monthly"
  | "monthly"
  | "quarterly"
  | "annually" {
  switch (cadence) {
    case "WEEKLY":
      return "weekly";
    case "BIWEEKLY":
      return "biweekly";
    case "SEMI_MONTHLY":
      return "semi_monthly";
    case "MONTHLY":
      return "monthly";
    case "QUARTERLY":
      return "quarterly";
    case "ANNUALLY":
      return "annually";
  }
}
