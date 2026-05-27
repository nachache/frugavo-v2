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
//
// v5 changes:
//
//   REGISTRY RESCUE. Single-occurrence streams whose merchant_key
//   matches the curated merchant-catalog.json are emitted (not
//   dropped by min_occurrences). The catalog is the trust gate: a
//   hand-vetted merchant carries enough identity weight to surface
//   even at one charge so the user sees it and the classifier can
//   decide confirm vs review.
//
//   DESCRIPTOR-KEYWORD RESCUE. Single-occurrence streams whose
//   descriptor contains "subscription", "membership", "club fee",
//   "recurring", or "renewal" are emitted as rescued. The keyword
//   is strong enough to warrant a review verdict (never auto-confirm).
//
//   TIER. Every emitted stream carries a tier tag: discretionary
//   (Netflix, Adobe, NYTimes…) vs fixed_commitment (Toyota loan,
//   Geico, rent, mortgage). Sourced from the catalog category for
//   known merchants; from a conservative descriptor regex for
//   unknowns. Allows downstream filtering of "things I can cancel"
//   vs "things I'm contractually locked into".

import catalog from "./data/merchant-catalog.json";

// ─── v5: catalog-derived registry + tier map ──────────────────────
//
// Built once at module load. The catalog is the only data input —
// the detector stays pure (no I/O, no Date.now()).

type CatalogMerchant = {
  key: string;
  display: string;
  category: string;
  aliases?: string[];
};
type CatalogShape = { merchants?: CatalogMerchant[] };

const CATALOG = catalog as CatalogShape;

// Set of every catalog merchant key. Used by the registry-rescue
// path to bypass min_occurrences for single-hit known merchants.
const KNOWN_MERCHANT_KEYS: Set<string> = new Set(
  (CATALOG.merchants ?? []).map((m) => m.key)
);

// Map from catalog merchant key → its category (streaming, news,
// insurance, telecom, etc.). Drives tier assignment for known
// merchants.
const KEY_TO_CATEGORY: Map<string, string> = new Map(
  (CATALOG.merchants ?? []).map((m) => [m.key, m.category])
);

// Categories that are discretionary spend (cancellable subscriptions
// the user could walk away from without a contractual obligation).
const DISCRETIONARY_CATEGORIES = new Set<string>([
  "streaming",
  "software",
  "news",
  "cloud_storage",
  "education",
  "fitness",
  "food_delivery",
  "gaming",
]);

// Categories that are fixed commitments (telecom contracts,
// insurance policies). Mortgages, rent, and consumer loans aren't
// usually in the catalog — those get caught by the descriptor regex
// below.
const FIXED_COMMITMENT_CATEGORIES = new Set<string>(["insurance", "telecom"]);

// Descriptor patterns for streams that aren't in the catalog but
// look like fixed commitments. Conservative — overlap with
// discretionary categories must be impossible.
const FIXED_COMMITMENT_DESCRIPTOR =
  /\b(mortgage|home\s+loan|auto\s+loan|car\s+loan|student\s+loan|loan\s+pmt|loan\s+payment|line\s+of\s+credit|insurance|premium|rent\s+pmt|rent\s+payment|lease\s+payment|property\s+mgmt|property\s+management|hoa\s+dues|toyota\s+fin|honda\s+fin|gm\s+financial|ford\s+credit|nissan\s+motor\s+accept|riverstone|equity\s+residential|childcare|daycare|electric|hydro|gas\s+(co|company|utility)|water\s+(util|board)|sewer|utility|utilities|wireless\s+pmt|t-?mobile|verizon|at&t|cox\s+communications|comcast|xfinity|spectrum)\b/i;

// Descriptor keywords that rescue a single-hit non-catalog stream
// to the "review" tier. Conservative — these are strong recurring-
// payment indicators that bank descriptors rarely use casually.
//
// Includes brand-agnostic autoship/subscribe-and-save signals so a
// single CHEWY.COM*AUTOSHIP or AMAZON SUBSCRIBE & SAVE charge rescues
// (the brand-specific token is the evidence), while a plain CHEWY
// charge without AUTOSHIP still falls through as a one-off purchase.
const RESCUE_KEYWORDS =
  /\b(subscription|membership|club\s+fee|club\s+dues|recurring|renewal|annual\s+fee|monthly\s+fee|autoship|subscribe\s+(and|&)\s+save|auto[\s-]?delivery|recurring\s+(order|delivery|shipment))\b/i;

function tierForStream(
  merchantKey: string,
  representativeDescriptor: string
): StreamTier {
  const category = KEY_TO_CATEGORY.get(merchantKey);
  if (category) {
    if (DISCRETIONARY_CATEGORIES.has(category)) return "discretionary";
    if (FIXED_COMMITMENT_CATEGORIES.has(category)) return "fixed_commitment";
    // Catalog hit with ambiguous category (e.g. "other") — fall
    // through to descriptor regex.
  }
  if (FIXED_COMMITMENT_DESCRIPTOR.test(representativeDescriptor)) {
    return "fixed_commitment";
  }
  // Default: discretionary. The brief requires every emitted stream
  // to be tagged, not just rescued ones. Streams that survive the
  // detector + classifier without firing a fixed-commitment signal
  // are most likely consumer subscriptions (gyms, software, content)
  // — defaulting to "discretionary" matches that prior. A stream
  // that's actually a hidden fixed commitment will surface through
  // either the catalog (add the merchant) or the descriptor regex
  // (add the keyword); both are data-driven.
  return "discretionary";
}

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
  // v6 — structured metadata extracted from the raw descriptor by
  // normalizeDescriptor. A non-null installment_total means the
  // descriptor encoded a finite payment schedule; the detector uses
  // this as a single-row rescue signal per brief Change 1.
  installment_index?: number | null;
  installment_total?: number | null;
  fx_currency?: string | null;
};

export type Cadence =
  | "WEEKLY"
  | "BIWEEKLY"
  | "SEMI_MONTHLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "ANNUALLY";

export type StreamTier = "discretionary" | "fixed_commitment";

// v6 / Change 4 — Transition events. A clean step in amount or a
// long gap inside a recurring stream is INFORMATION, not noise. We
// emit typed events so the classifier and downstream UI can present
// these moments as confirmations + transitions instead of variance
// penalties.
export type StreamEvent =
  | {
      type: "price_change";
      from_amount_dollars: number;
      to_amount_dollars: number;
      at_date: string;
    }
  | {
      type: "pause_resume";
      gap_days: number;
      at_date: string;
    };

export type RescueReason =
  | "registry"
  | "descriptor_keyword"
  | "finite_schedule"
  | "reconciled"
  | "multi_charge_below_min";

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
  // v5 — tier classifies every emitted stream into discretionary
  // (streaming, software, news, gyms, etc.) vs fixed_commitment
  // (loans, rent, insurance, utilities, mortgages, telecom). Set
  // from catalog category first, then a descriptor regex for
  // unknowns (Toyota loan, Riverstone rent), then defaults to
  // discretionary so every confirmed stream gets a tag.
  tier: StreamTier;
  // v5 — rescued: single-hit streams emitted because the merchant
  // matched the catalog (rescue_reason="registry") or carried a
  // strong subscription keyword in its descriptor
  // (rescue_reason="descriptor_keyword"). Without rescue these
  // single hits would be dropped by the min_occurrences gate.
  rescued: boolean;
  rescue_reason: RescueReason | null;
  // v6 / Change 4 — within-stream transition events. Empty array
  // when the stream is uniform. Populated by detectStreamEvents
  // when the kept charges contain a level shift (price_change) or
  // an anomalous gap (pause_resume). These let the classifier and
  // UI surface a price step-up as a confirm + event rather than a
  // variance penalty.
  events: StreamEvent[];
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
    // MONTHLY upper raised 50 -> 75 to cover real-world monthly subs
    // that skip a billing cycle (paused membership, late posting,
    // every-other-month products marketed as "monthly"). 71d gaps
    // were previously falling into the dead zone between MONTHLY
    // and QUARTERLY and getting silently dropped.
    { name: "MONTHLY", min: 20, max: 75 },
    { name: "QUARTERLY", min: 80, max: 100 },
    { name: "ANNUALLY", min: 330, max: 400 },
  ],
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Collapse same-day same-merchant_key transactions into one synthetic
// charge. WHY: utility / property-tax / insurance billers commonly
// post multiple line items on a single day — e.g. PC-Gatineau debits
// seven separate property-tax parcels on the same day, Hydro-Quebec
// posts a 3-charge electricity batch, Gazifere posts gas in sets of
// three monthly. The raw transaction stream has zero-day gaps inside
// each batch; the detector's median-gap math then resolves to 0 days,
// which falls into no cadence band (smallest band starts at 4 days),
// and the entire merchant gets dropped with `no_cadence_band`.
//
// After collapse: each same-day cluster becomes one event with the
// summed amount. The detector sees monthly cadence between batches
// (~30 days) and accepts the stream. The merchant's reported
// monthly equivalent is correct because we summed within the day.
//
// Single-charge days are passed through unchanged. Stable sort by
// date so downstream gap computation stays deterministic.
function collapseSameDayCharges(items: TxnInput[]): TxnInput[] {
  if (items.length <= 1) return items;
  const byDate = new Map<string, TxnInput[]>();
  for (const t of items) {
    const arr = byDate.get(t.date) ?? [];
    arr.push(t);
    byDate.set(t.date, arr);
  }
  const collapsed: TxnInput[] = [];
  for (const [date, group] of byDate) {
    if (group.length === 1) {
      collapsed.push(group[0]);
      continue;
    }
    // Sum signed amounts (all outflows here, so all negative).
    const sumAmount = group.reduce((s, t) => s + t.amount_dollars, 0);
    // Use the middle item as template — preserves currency, descriptor,
    // PFC, and canonical_name. Override amount + txn_id so the synthetic
    // event is identifiable in audits.
    const template = group[Math.floor(group.length / 2)];
    collapsed.push({
      ...template,
      txn_id: `collapsed:${template.merchant_key}:${date}:${group.length}`,
      amount_dollars: sumAmount,
    });
  }
  collapsed.sort((a, b) => a.date.localeCompare(b.date));
  return collapsed;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  );
}

// v6 / Change 3 — Multi-stream keys.
//
// Sub-bucket items inside one merchant_key by amount band so concurrent
// recurring lines at different price tiers stay as distinct streams
// instead of collapsing into one ambiguous bucket. Example: a merchant
// billing $2.99 iCloud AND $10.99 Music under one identity used to
// produce one stream whose median lived between the two amounts and
// whose drift filter rejected both halves; now they're two streams.
//
// Algorithm: greedy single-link clustering on the sorted amounts. A
// new band opens when the next amount exceeds AMOUNT_BAND_RATIO ×
// the current band's running median. The ratio is 1.5 — half-again
// the median — which is wider than the per-charge drift tolerance
// (drift_usd = 0.25 = 25%) so usage-based billing within one plan
// stays in one band, but a clear tier difference (2× or more) splits.
//
// Principle (brief): a merchant can have N concurrent recurring lines.
// Amount banding tolerates small drift but keeps distinct price tiers
// separate.
const AMOUNT_BAND_RATIO = 1.5;

// v6 / Change 4 — Level-shift + pause detection inside a kept item
// series. Detects regime changes that a single global dispersion
// statistic would absorb as noise.
//
// detectAmountShifts walks each consecutive split point, comparing
// the median of items[0..k] against the median of items[k..N]. A
// shift fires when the ratio between the two medians exceeds
// LEVEL_SHIFT_THRESHOLD AND both segments have ≥ 2 items. We take
// the SHARPEST shift (largest score) when multiple candidates exist;
// recursing wasn't necessary for the recall/precision target and
// keeps the segmentation predictable.
//
// detectPauseResume scans gaps between successive items, marking any
// gap whose length exceeds PAUSE_GAP_MULTIPLE × the median gap as a
// pause_resume event.
//
// Principle (brief): a regime change is information, not variance.
const LEVEL_SHIFT_THRESHOLD = 0.4; // 40% median-to-median delta
const PAUSE_GAP_MULTIPLE = 3.0; // 3× the median gap

function detectStreamEvents(items: TxnInput[]): StreamEvent[] {
  if (items.length < 4) return [];
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const events: StreamEvent[] = [];

  // ─── Amount level shift ──────────────────────────────────────
  let bestShiftScore = 0;
  let bestShiftK = -1;
  for (let k = 2; k <= sorted.length - 2; k++) {
    const left = sorted.slice(0, k).map((t) => Math.abs(t.amount_dollars));
    const right = sorted.slice(k).map((t) => Math.abs(t.amount_dollars));
    const ml = median(left);
    const mr = median(right);
    const denom = Math.max(ml, mr, 0.01);
    const score = Math.abs(ml - mr) / denom;
    if (score > bestShiftScore && score >= LEVEL_SHIFT_THRESHOLD) {
      bestShiftScore = score;
      bestShiftK = k;
    }
  }
  if (bestShiftK > 0) {
    const ml = median(
      sorted.slice(0, bestShiftK).map((t) => Math.abs(t.amount_dollars))
    );
    const mr = median(
      sorted.slice(bestShiftK).map((t) => Math.abs(t.amount_dollars))
    );
    events.push({
      type: "price_change",
      from_amount_dollars: Number(ml.toFixed(2)),
      to_amount_dollars: Number(mr.toFixed(2)),
      at_date: sorted[bestShiftK].date,
    });
  }

  // ─── Pause-resume ────────────────────────────────────────────
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
  }
  if (gaps.length >= 3) {
    const medGap = median(gaps);
    if (medGap > 0) {
      for (let i = 0; i < gaps.length; i++) {
        if (gaps[i] > medGap * PAUSE_GAP_MULTIPLE && gaps[i] - medGap >= 14) {
          events.push({
            type: "pause_resume",
            gap_days: gaps[i],
            at_date: sorted[i + 1].date,
          });
        }
      }
    }
  }

  return events;
}

// Within-segment dispersion. When a stream has a price_change event,
// the GLOBAL cv on the whole series is inflated; the LAST segment's
// cv is what the user is currently experiencing and is the more
// accurate "is this stable" signal.
export function withinLastSegmentItems(
  items: TxnInput[],
  events: StreamEvent[]
): TxnInput[] {
  const shifts = events.filter((e) => e.type === "price_change");
  if (shifts.length === 0) return items;
  const lastShift = shifts[shifts.length - 1];
  const lastShiftDate = (lastShift as { at_date: string }).at_date;
  return items.filter((t) => t.date >= lastShiftDate);
}

// v6 / Change 2 — Reconciliation token utilities.
//
// Tokens used to detect that two orphan rejected groups share a brand
// root despite landing on different merchant_keys. Pure structural
// filtering: alphabetic tokens of length >= 4, minus a STOP set of
// payment-language words (these aren't brands; they don't identify a
// merchant). No merchant brand names go in STOP — the list is purely
// payment vocabulary. The literal-guard in scripts/scan-harness.ts
// already classifies these tokens as structural, so adding them here
// stays within the no-merchant-literal rule.
const RECONCILE_STOP = new Set<string>([
  "payment","pmt","invoice","order","item","items","service","services",
  "monthly","annual","weekly","daily","quarterly","yearly","recurring",
  "installment","installments","inc","llc","corp","ltd","co","inc.",
  "limited","company","group","holdings","plc","autopay","autoship",
  "subscription","membership","subscribe","auto","pay","charge","charges",
  "purchase","purchased","direct","debit","credit","epayment","payments",
  "receipt","ref","fee","fees","online","web","mobile","app","store","loc",
  "branch","location","total","amount","usa","ach",
]);

function reconcileTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(
        (t) => t.length >= 4 && !RECONCILE_STOP.has(t) && !/^\d+$/.test(t)
      )
  );
}

function sharesTokenRoot(a: string, b: string): boolean {
  const ta = reconcileTokens(a);
  const tb = reconcileTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

// Amount compatibility: both amounts within drift_usd of their mean.
function amountsCompatible(a: number, b: number, drift: number): boolean {
  const mean = (Math.abs(a) + Math.abs(b)) / 2;
  if (mean === 0) return false;
  return Math.abs(Math.abs(a) - Math.abs(b)) / mean <= drift;
}

// Date sequence forms a known cadence band when every consecutive gap
// (and the overall span) fits inside one band. We don't require every
// gap to be IDENTICAL — we require the median gap to land in a band
// and no individual gap to wander outside it by more than ~30%. That
// matches the existing detector's tolerance.
function cadenceFromDates(
  dates: string[],
  bandList: DetectorParams["cadence_bands"]
): Cadence | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  }
  const med = median(gaps);
  const band = bandFor(med, bandList);
  if (!band) return null;
  for (const g of gaps) {
    if (g < med * 0.6 || g > med * 1.5) return null;
  }
  return band;
}

function bandsForMerchantItems(items: TxnInput[]): TxnInput[][] {
  if (items.length <= 1) return [items];
  const sorted = [...items].sort(
    (a, b) => Math.abs(a.amount_dollars) - Math.abs(b.amount_dollars)
  );
  const bands: TxnInput[][] = [];
  let currentBand: TxnInput[] = [sorted[0]];
  let currentMedian = Math.abs(sorted[0].amount_dollars);
  for (let i = 1; i < sorted.length; i++) {
    const amt = Math.abs(sorted[i].amount_dollars);
    // Guard against div-by-zero on degenerate zero-amount sequences.
    const ratio = currentMedian > 0 ? amt / currentMedian : 1;
    if (ratio <= AMOUNT_BAND_RATIO) {
      currentBand.push(sorted[i]);
      const amts = currentBand
        .map((t) => Math.abs(t.amount_dollars))
        .sort((a, b) => a - b);
      currentMedian = amts[Math.floor(amts.length / 2)];
    } else {
      bands.push(currentBand);
      currentBand = [sorted[i]];
      currentMedian = amt;
    }
  }
  bands.push(currentBand);
  // Restore date ordering inside each band so downstream gap math
  // stays correct.
  for (const b of bands) b.sort((a, b) => a.date.localeCompare(b.date));
  return bands;
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
  // v6 / Change 2 — orphans tracker. Every group that lands on a
  // standard reject (not registry/keyword/schedule rescued) gets
  // pushed here with the audit index it produced. After the main
  // loop completes, the reconciliation pass clusters compatible
  // orphans (matching amount + shared brand-root token + regular
  // date spacing) and re-emits each cluster as a single stream —
  // mutating the matching audit decisions from rejected to accepted.
  type Orphan = {
    items: TxnInput[];
    auditIndex: number;
    key: string;
  };
  const orphans: Orphan[] = [];

  for (const [key, rawItems] of groups) {
    // Same-day batch collapse — see collapseSameDayCharges() doc.
    // This MUST run before drift + cadence math; otherwise multi-charge
    // batches inflate occurrences and zero out median_gap_days.
    const collapsedItems = collapseSameDayCharges(rawItems);
    // v6 / Change 3 — split the merchant's items into amount bands so
    // distinct price tiers from the same merchant stay separate.
    const bands = bandsForMerchantItems(collapsedItems);
    for (let bandIdx = 0; bandIdx < bands.length; bandIdx++) {
      const items = bands[bandIdx];
      // Band-suffixed key for audit uniqueness when one merchant has
      // multiple bands. Single-band merchants keep their original key
      // so existing logs/snapshots stay readable.
      const auditKey =
        bands.length === 1 ? key : `${key}__b${bandIdx + 1}`;
      const rep = items[Math.floor(items.length / 2)];
      const repDescriptor = rep?.raw_descriptor ?? "";

    // Step 1: drift tolerance per item, against group median.
    const amounts = items.map((t) => Math.abs(t.amount_dollars));
    const medAmount = median(amounts);
    if (medAmount === 0) {
      audits.push({
        merchant_key: auditKey,
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
        merchant_key: auditKey,
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

    // ─── v5 rescue check ──────────────────────────────────────────
    //
    // Before rejecting on min_occurrences or no_cadence_band, see
    // whether this group qualifies for single-hit rescue:
    //   • registry: merchant_key is in the curated catalog. The
    //     catalog is the trust gate — a hand-vetted merchant on
    //     one charge is worth surfacing.
    //   • descriptor_keyword: representative descriptor contains
    //     a strong recurring-payment word (subscription, membership,
    //     club fee, recurring, renewal, annual/monthly fee).
    // Rescued streams default to MONTHLY cadence (the most common
    // recurring billing) and carry rescued=true so downstream can
    // route them to review instead of auto-confirming.
    const failsMinOcc = kept.length < minOcc;
    const failsBand = !band;
    if (failsMinOcc || failsBand) {
      const registryHit = KNOWN_MERCHANT_KEYS.has(key);
      const keywordHit = RESCUE_KEYWORDS.test(repDescriptor);
      // v6 — finite-schedule rescue. A descriptor encoding "N of M"
      // (extracted by normalizeDescriptor into installment_total) is
      // strong structural evidence of an ongoing commitment, even on
      // a single observation. Per brief Change 1: such a descriptor
      // is on its own sufficient.
      const scheduleHit = items.some(
        (t) =>
          typeof t.installment_total === "number" &&
          t.installment_total !== null &&
          t.installment_total >= 2
      );
      // v6 / Change 5 — low-confidence rescue. A multi-charge group
      // that found a cadence band but didn't quite hit the band's
      // minimum occurrence count looks recurring, just thinly. Per
      // brief: "Everything else that looks recurring exits as
      // low-confidence review — NEVER silently dropped." This is
      // the structural net for evidence-light recurrence; the
      // classifier still adjudicates the verdict (Gate A drops
      // provable non-merchant flows like transfers, fees, brokerage).
      const lowConfidenceHit = failsMinOcc && band !== null && kept.length >= 2;
      if (registryHit || keywordHit || scheduleHit || lowConfidenceHit) {
        const lastDate = kept[kept.length - 1].date;
        const avg =
          kept.reduce((s, t) => s + Math.abs(t.amount_dollars), 0) /
          kept.length;
        const rescuedFrequency: Cadence = band ?? "MONTHLY";
        const rescuedGap = medianGap || 30;
        streams.push({
          merchant_key: auditKey,
          canonical_name: rep.canonical_name,
          representative_descriptor: rep.raw_descriptor,
          normalized_descriptor: rep.normalized_descriptor,
          occurrences: kept.length,
          median_gap_days: medianGap,
          frequency: rescuedFrequency,
          average_amount_dollars: avg,
          median_amount_dollars: medAmount,
          currency: rep.currency,
          last_date: lastDate,
          next_expected_date: addDays(lastDate, rescuedGap),
          transactions: kept,
          outliers,
          pfc_primary: rep.pfc_primary ?? null,
          pfc_detailed: rep.pfc_detailed ?? null,
          tier: tierForStream(key, rep.raw_descriptor),
          rescued: true,
          rescue_reason: registryHit
            ? "registry"
            : scheduleHit
              ? "finite_schedule"
              : keywordHit
                ? "descriptor_keyword"
                : "multi_charge_below_min",
          events: detectStreamEvents(kept),
        });
        audits.push({
          merchant_key: auditKey,
          representative_descriptor: rep.raw_descriptor,
          raw_count: items.length,
          kept_count: kept.length,
          outlier_count: outliers.length,
          median_gap_days: medianGap,
          median_amount_dollars: medAmount,
          decision: "accepted",
          cadence: rescuedFrequency,
        });
        continue;
      }
      // No rescue — record the standard reject audit AND park this
      // group on the orphans list so the post-loop reconciliation pass
      // can try to cluster it with structurally-compatible orphans.
      const auditIndex = audits.length;
      audits.push({
        merchant_key: auditKey,
        representative_descriptor: repDescriptor,
        raw_count: items.length,
        kept_count: kept.length,
        outlier_count: outliers.length,
        median_gap_days: medianGap,
        median_amount_dollars: medAmount,
        decision: "rejected",
        cadence: band,
        rejection_reason: failsMinOcc
          ? band
            ? "below_min_occurrences"
            : "below_min_occurrences_no_band"
          : "no_cadence_band",
        required_occurrences: failsMinOcc ? minOcc : undefined,
      });
      orphans.push({ items: kept, auditIndex, key: auditKey });
      continue;
    }

    const lastDate = kept[kept.length - 1].date;
    const avg =
      kept.reduce((s, t) => s + Math.abs(t.amount_dollars), 0) / kept.length;

    streams.push({
      merchant_key: auditKey,
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
      tier: tierForStream(key, rep.raw_descriptor),
      rescued: false,
      rescue_reason: null,
      events: detectStreamEvents(kept),
    });

    audits.push({
      merchant_key: auditKey,
      representative_descriptor: rep.raw_descriptor,
      raw_count: items.length,
      kept_count: kept.length,
      outlier_count: outliers.length,
      median_gap_days: medianGap,
      median_amount_dollars: medAmount,
      decision: "accepted",
      cadence: band,
    });
    } // end band loop
  }

  // ─── v6 / Change 2: Reconciliation pass ─────────────────────────
  //
  // Walk the orphans collected during the main loop and try to
  // re-form clusters from compatible fragments. A pair of orphans is
  // compatible when: (a) their representative amounts match within
  // the drift tolerance, AND (b) their descriptors share at least
  // one alphabetic brand-root token of length >= 4 (payment-language
  // stop-words excluded). A cluster of >= 2 orphans whose combined
  // dates fit one cadence band becomes an emitted stream; its source
  // audits flip from rejected to accepted.
  //
  // Principle: rejection becomes a net, not a cliff. Single-hit
  // groups that the canonicalizer didn't manage to merge get a
  // structural second chance.
  if (orphans.length > 1) {
    const used = new Array(orphans.length).fill(false);
    for (let i = 0; i < orphans.length; i++) {
      if (used[i]) continue;
      // Build a cluster from orphan i and every later orphan that's
      // compatible with the SEED orphan. Greedy single-link is fine
      // at this scale (orphans are bounded by distinct merchant_keys
      // × bands).
      const seed = orphans[i];
      const seedItems = seed.items;
      if (seedItems.length === 0) continue;
      const seedAmt = Math.abs(
        median(seedItems.map((t) => Math.abs(t.amount_dollars)))
      );
      const seedRep = seedItems[Math.floor(seedItems.length / 2)];
      const seedDesc = seedRep.raw_descriptor;
      const cluster: number[] = [i];
      for (let j = i + 1; j < orphans.length; j++) {
        if (used[j]) continue;
        const other = orphans[j];
        if (other.items.length === 0) continue;
        const otherAmt = Math.abs(
          median(other.items.map((t) => Math.abs(t.amount_dollars)))
        );
        if (!amountsCompatible(seedAmt, otherAmt, params.drift_usd)) continue;
        const otherDesc =
          other.items[Math.floor(other.items.length / 2)].raw_descriptor;
        if (!sharesTokenRoot(seedDesc, otherDesc)) continue;
        cluster.push(j);
      }
      if (cluster.length < 2) continue;
      // Combine items, check cadence regularity.
      const combined: TxnInput[] = cluster.flatMap((idx) => orphans[idx].items);
      combined.sort((a, b) => a.date.localeCompare(b.date));
      const dates = combined.map((t) => t.date);
      const band = cadenceFromDates(dates, params.cadence_bands);
      if (!band) continue;
      const minOcc =
        params.min_occurrences_by_band[band] ??
        params.min_occurrences_by_band.default;
      if (combined.length < minOcc) continue;
      // Emit a reconciled stream. Use the median item's metadata for
      // identity. The merchant_key reflects that it came from a
      // reconciled cluster so audits stay traceable.
      const rep = combined[Math.floor(combined.length / 2)];
      const amts = combined.map((t) => Math.abs(t.amount_dollars));
      const medAmount = median(amts);
      const avg = amts.reduce((s, a) => s + a, 0) / amts.length;
      const gaps: number[] = [];
      for (let k = 1; k < combined.length; k++) {
        gaps.push(daysBetween(combined[k - 1].date, combined[k].date));
      }
      const medianGap = median(gaps);
      const lastDate = combined[combined.length - 1].date;
      const reconciledKey = `${rep.merchant_key}__reconciled`;
      streams.push({
        merchant_key: reconciledKey,
        canonical_name: rep.canonical_name,
        representative_descriptor: rep.raw_descriptor,
        normalized_descriptor: rep.normalized_descriptor,
        occurrences: combined.length,
        median_gap_days: medianGap,
        frequency: band,
        average_amount_dollars: avg,
        median_amount_dollars: medAmount,
        currency: rep.currency,
        last_date: lastDate,
        next_expected_date: addDays(lastDate, medianGap),
        transactions: combined,
        outliers: [],
        pfc_primary: rep.pfc_primary ?? null,
        pfc_detailed: rep.pfc_detailed ?? null,
        tier: tierForStream(rep.merchant_key, rep.raw_descriptor),
        rescued: true,
        rescue_reason: "reconciled",
        events: detectStreamEvents(combined),
      });
      // Flip the source audits to accepted so the silent-drops
      // metric correctly reflects the rescue.
      for (const idx of cluster) {
        used[idx] = true;
        const aIdx = orphans[idx].auditIndex;
        if (audits[aIdx]) {
          audits[aIdx] = {
            ...audits[aIdx],
            decision: "accepted",
            cadence: band,
            rejection_reason: undefined,
            required_occurrences: undefined,
          };
        }
      }
    }
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
