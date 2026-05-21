// Pure recurrence-detection engine.
//
// Takes an arbitrary array of transactions, returns the recurring
// streams. No I/O, no Plaid, no DB, no AI, no Date.now(). Same input
// + same parameters → byte-identical output.
//
// Calibration notes (v3.1.0):
//
//   MIN_OCCURRENCES is BAND-DEPENDENT. A monthly subscription needs
//   only 2 charges (= ~1 month of history) to register; an annual
//   subscription also needs only 2 charges (= ~2 years of history),
//   which is achievable for many users, whereas the old global
//   threshold of 3 made annual detection structurally impossible.
//   Lower thresholds increase recall; the classifier (Gate A/B) is
//   the precision gate that prevents this from turning into noise.
//
//   AMOUNT DRIFT TOLERANCE widened to 0.25 (was 0.15). Usage-based
//   billing (OpenAI, AWS, n8n) swings amounts 30%+ between months.
//   The previous tolerance rejected those charges as outliers, the
//   surviving group fell below MIN_OCCURRENCES, and the subscription
//   was silently dropped.
//
//   MONTHLY CADENCE BAND widened to 20–50 days. End-of-month posting
//   drift, weekend nudges, and the Feb-28 / Feb-29 edge regularly
//   push real monthly subs to 22-day or 47-day gaps.
//
//   AUDIT array. detectRecurringStreams now returns audits for every
//   group it considered — kept or rejected — with the rejection
//   reason. The caller can emit these to logs to debug recall loss.

export type TxnInput = {
  txn_id: string;
  date: string; // "YYYY-MM-DD"
  amount_dollars: number; // negative = outflow
  currency: string;
  raw_descriptor: string;
  merchant_key: string;
  canonical_name: string;
  normalized_descriptor: string;
  // Optional Plaid PFC tags. Carried through so the classifier downstream
  // gets the signal even when /transactions/recurring/get enrichment is
  // unavailable. Detection itself does NOT read these.
  pfc_primary?: string | null;
  pfc_detailed?: string | null;
};

export type Cadence =
  | "WEEKLY"
  | "BIWEEKLY"
  | "SEMI_MONTHLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "ANNUALLY";

export type DetectedStream = {
  merchant_key: string;
  canonical_name: string;
  representative_descriptor: string;
  normalized_descriptor: string;
  occurrences: number;
  median_gap_days: number;
  frequency: Cadence;
  average_amount_dollars: number;
  median_amount_dollars: number;
  currency: string;
  last_date: string;
  next_expected_date: string;
  transactions: TxnInput[];
  outliers: TxnInput[];
  pfc_primary: string | null;
  pfc_detailed: string | null;
};

export type RejectionReason =
  | "median_amount_zero"
  | "all_drifted"
  | "below_min_occurrences_no_band"
  | "below_min_occurrences"
  | "no_cadence_band";

export type GroupAudit = {
  merchant_key: string;
  representative_descriptor: string;
  raw_count: number;
  kept_count: number;
  outlier_count: number;
  median_gap_days: number;
  median_amount_dollars: number;
  decision: "accepted" | "rejected";
  cadence: Cadence | null;
  rejection_reason?: RejectionReason;
  required_occurrences?: number;
};

export type DetectorParams = {
  // Band-specific minimum occurrence counts. Keys MUST cover every
  // cadence band, plus a "default" fallback for groups whose cadence
  // we haven't classified yet.
  min_occurrences_by_band: Record<Cadence, number> & { default: number };
  drift_usd: number;
  drift_fx: number;
  cadence_bands: { name: Cadence; min: number; max: number }[];
};

export const DEFAULT_PARAMS: DetectorParams = {
  min_occurrences_by_band: {
    default: 2,
    WEEKLY: 4,
    BIWEEKLY: 3,
    SEMI_MONTHLY: 2,
    MONTHLY: 2,
    QUARTERLY: 2,
    ANNUALLY: 2,
  },
  drift_usd: 0.25,
  drift_fx: 0.35,
  cadence_bands: [
    { name: "WEEKLY", min: 4, max: 9 },
    { name: "BIWEEKLY", min: 10, max: 18 },
    { name: "SEMI_MONTHLY", min: 19, max: 22 },
    { name: "MONTHLY", min: 20, max: 50 },
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
): Cadence | null {
  for (const b of bands) {
    if (gap >= b.min && gap <= b.max) return b.name;
  }
  return null;
}

export type DetectorResult = {
  streams: DetectedStream[];
  audits: GroupAudit[];
};

export function detectRecurringStreams(
  txns: TxnInput[],
  params: DetectorParams = DEFAULT_PARAMS
): DetectorResult {
  const outflows = txns.filter((t) => t.amount_dollars < 0);

  const groups = new Map<string, TxnInput[]>();
  for (const t of outflows) {
    const arr = groups.get(t.merchant_key) ?? [];
    arr.push(t);
    groups.set(t.merchant_key, arr);
  }

  const streams: DetectedStream[] = [];
  const audits: GroupAudit[] = [];

  for (const [key, items] of groups) {
    const rep = items[Math.floor(items.length / 2)];
    const repDescriptor = rep?.raw_descriptor ?? "";

    // Step 1: drift tolerance per item, against group median.
    const amounts = items.map((t) => Math.abs(t.amount_dollars));
    const medAmount = median(amounts);
    if (medAmount === 0) {
      audits.push({
        merchant_key: key,
        representative_descriptor: repDescriptor,
        raw_count: items.length,
        kept_count: 0,
        outlier_count: items.length,
        median_gap_days: 0,
        median_amount_dollars: 0,
        decision: "rejected",
        cadence: null,
        rejection_reason: "median_amount_zero",
      });
      continue;
    }

    const kept: TxnInput[] = [];
    const outliers: TxnInput[] = [];
    for (const t of items) {
      const tol =
        t.currency.toUpperCase() !== "USD" ? params.drift_fx : params.drift_usd;
      const diff = Math.abs(Math.abs(t.amount_dollars) - medAmount) / medAmount;
      if (diff <= tol) kept.push(t);
      else outliers.push(t);
    }

    if (kept.length === 0) {
      audits.push({
        merchant_key: key,
        representative_descriptor: repDescriptor,
        raw_count: items.length,
        kept_count: 0,
        outlier_count: outliers.length,
        median_gap_days: 0,
        median_amount_dollars: medAmount,
        decision: "rejected",
        cadence: null,
        rejection_reason: "all_drifted",
      });
      continue;
    }

    // Stable order by date.
    kept.sort((a, b) => a.date.localeCompare(b.date));

    // Step 2: cadence detection.
    const gaps: number[] = [];
    for (let i = 1; i < kept.length; i++) {
      gaps.push(daysBetween(kept[i - 1].date, kept[i].date));
    }
    const medianGap = gaps.length === 0 ? 0 : median(gaps);
    const band =
      gaps.length === 0 ? null : bandFor(medianGap, params.cadence_bands);

    // Step 3: min occurrences — band-dependent. Groups with no cadence
    // yet fall back to `default`.
    const minOcc =
      params.min_occurrences_by_band[band ?? "MONTHLY"] !== undefined && band
        ? params.min_occurrences_by_band[band]
        : params.min_occurrences_by_band.default;

    if (kept.length < minOcc) {
      audits.push({
        merchant_key: key,
        representative_descriptor: repDescriptor,
        raw_count: items.length,
        kept_count: kept.length,
        outlier_count: outliers.length,
        median_gap_days: medianGap,
        median_amount_dollars: medAmount,
        decision: "rejected",
        cadence: band,
        rejection_reason: band
          ? "below_min_occurrences"
          : "below_min_occurrences_no_band",
        required_occurrences: minOcc,
      });
      continue;
    }

    if (!band) {
      audits.push({
        merchant_key: key,
        representative_descriptor: repDescriptor,
        raw_count: items.length,
        kept_count: kept.length,
        outlier_count: outliers.length,
        median_gap_days: medianGap,
        median_amount_dollars: medAmount,
        decision: "rejected",
        cadence: null,
        rejection_reason: "no_cadence_band",
      });
      continue;
    }

    const lastDate = kept[kept.length - 1].date;
    const avg =
      kept.reduce((s, t) => s + Math.abs(t.amount_dollars), 0) / kept.length;

    streams.push({
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
      pfc_primary: rep.pfc_primary ?? null,
      pfc_detailed: rep.pfc_detailed ?? null,
    });

    audits.push({
      merchant_key: key,
      representative_descriptor: rep.raw_descriptor,
      raw_count: items.length,
      kept_count: kept.length,
      outlier_count: outliers.length,
      median_gap_days: medianGap,
      median_amount_dollars: medAmount,
      decision: "accepted",
      cadence: band,
    });
  }

  // Deterministic ordering.
  streams.sort((a, b) => a.merchant_key.localeCompare(b.merchant_key));
  audits.sort((a, b) => a.merchant_key.localeCompare(b.merchant_key));
  return { streams, audits };
}

export function cadenceToFrequency(
  cadence: Cadence
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
