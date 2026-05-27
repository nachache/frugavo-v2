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

// v7 / Problem 2 — Generic fixed-commitment vocabulary ONLY. Auto-
// loan lender brands, telecom carrier brands, and rent management
// brands have been removed; merchant identity comes from the catalog
// (data) or PFC tags. The remaining words describe a CATEGORY
// (mortgage, insurance, rent, utility, telecom-service-type) — none
// is a specific company name.
const FIXED_COMMITMENT_DESCRIPTOR =
  /\b(mortgage|home\s+loan|auto\s+loan|car\s+loan|student\s+loan|loan\s+pmt|loan\s+payment|line\s+of\s+credit|insurance|premium|rent\s+pmt|rent\s+payment|lease\s+payment|property\s+mgmt|property\s+management|hoa\s+dues|childcare|daycare|electric|hydro|gas\s+(co|company|utility)|water\s+(util|board)|sewer|utility|utilities|wireless\s+pmt|cable\s+co|broadband|internet\s+(svc|service)|isp\s+payment)\b/i;

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

// v7 / Problem 8 — Two different same-day patterns need different
// handling:
//
//   (a) DUPLICATE: same merchant, same day, IDENTICAL amount. This is
//       either a bank-replay artifact (e.g. an authorization that
//       posts twice) or a true duplicate the user got charged once
//       for. Collapse to ONE occurrence — never inflate counts or
//       spawn a second stream.
//
//   (b) BATCH BILLER: same merchant, same day, DIFFERENT amounts. This
//       is the utility / property-tax / insurance pattern where the
//       biller posts multiple line items (e.g. property-tax parcels,
//       multi-utility electricity batch). Sum the amounts so the
//       median-gap math doesn't see zero-day gaps and the monthly
//       equivalent is correct.
//
// Distinguishing them by amount equality is structural (no merchant
// knowledge, no thresholds). For (a) we keep one representative item
// unchanged; for (b) we still sum.
//
// Single-charge days pass through unchanged. Output is sorted by date
// so downstream gap computation stays deterministic.
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
    // v7 / Problem 8 — bucket the group by amount equality. If every
    // item has the same amount, that's a DUPLICATE pattern: keep one
    // representative, drop the rest. If amounts differ, that's a
    // BATCH biller: sum them (the legacy behavior).
    const amounts = group.map((t) => Math.abs(t.amount_dollars));
    const allEqual = amounts.every((a) => a === amounts[0]);
    if (allEqual) {
      // Keep one representative; the others were silent duplicates.
      // Tag the txn_id so audits can see this was deduped (the
      // possible_duplicate signal lives in the txn_id prefix —
      // adding a new field on TxnInput would force every fixture +
      // caller to set it).
      const template = group[Math.floor(group.length / 2)];
      collapsed.push({
        ...template,
        txn_id: `dedup:${template.merchant_key}:${date}:x${group.length}`,
      });
      continue;
    }
    // Sum signed amounts (all outflows here, so all negative). This
    // is the utility / property-tax batch case.
    const sumAmount = group.reduce((s, t) => s + t.amount_dollars, 0);
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

// v6 / Change 3 — Multi-stream keys (banding implementation moved
// below to use distribution-shape splitting per v7 / Problem 3).
// Principle (brief): a merchant can have N concurrent recurring
// lines; split only when amounts form distinct internally-tight
// clusters separated by a gap large relative to within-cluster
// spacing.

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

// v7 / Problem 3 — replaces ratio-based banding with distribution-
// shape natural-breaks. Single threshold (SHAPE_SPLIT_THRESHOLD = 4)
// captures the principle: a real tier separation has a within-cluster
// gap structure of one big break and many small ones; a continuous
// variable-spend distribution has roughly-uniform gaps with no
// dominant break. The 4× ratio between the largest gap and the median
// of the others triggers split only in the former case.
const SHAPE_SPLIT_THRESHOLD = 4;

function bandsForMerchantItems(items: TxnInput[]): TxnInput[][] {
  if (items.length <= 2) return [items];
  const sorted = [...items].sort(
    (a, b) => Math.abs(a.amount_dollars) - Math.abs(b.amount_dollars)
  );
  const result = shapeSplit(sorted);
  for (const b of result) b.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

// v7 / Problem 6 — Price-change linking.
//
// When amount banding splits a merchant into multiple bands AND their
// date ranges are sequential (non-overlapping in time), they describe
// a single continuing stream that changed price. The OLD level
// stopped existing when the NEW level started. Emitting both as
// parallel streams was wrong on three counts: it overcounts active
// commitments, it shows a stale "current" amount for the old level,
// and it loses the price-change information that's the user-facing
// value here.
//
// This pass runs AFTER the band loop produces candidates for one
// merchant. Same-cadence bands whose date ranges don't overlap merge
// into one stream. The latest band's median/average defines the
// CURRENT amount; a price_change event is appended for each transition
// (combinedItems become one chronological series). Concurrent bands
// (overlapping date ranges) stay separate streams — they're real
// parallel plans, not sequential price changes.
//
// Principle (brief): one merchant, sequential price levels, same
// cadence → one continuing stream + price_change event. Never emit
// the old level as a stream while dropping the new one.
function mergeSequentialPriceLevels(
  candidates: DetectedStream[]
): DetectedStream[] {
  if (candidates.length <= 1) return candidates;

  // Group by cadence — only same-cadence sequential bands can merge.
  const byCadence = new Map<Cadence, DetectedStream[]>();
  for (const s of candidates) {
    const arr = byCadence.get(s.frequency) ?? [];
    arr.push(s);
    byCadence.set(s.frequency, arr);
  }

  const out: DetectedStream[] = [];
  for (const group of byCadence.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    // Sort by first transaction date so we walk earliest-to-latest.
    const sorted = [...group].sort((a, b) => {
      const aFirst = a.transactions[0]?.date ?? "";
      const bFirst = b.transactions[0]?.date ?? "";
      return aFirst.localeCompare(bFirst);
    });
    let current = sorted[0];
    const merged: DetectedStream[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      const currentLast = current.last_date;
      const nextFirst = next.transactions[0]?.date ?? "";
      const overlapping = nextFirst <= currentLast;
      if (overlapping) {
        // Concurrent plans — emit current, switch to next.
        merged.push(current);
        current = next;
        continue;
      }
      // Sequential: merge next into current. Latest level wins on
      // amount; the transition becomes a price_change event.
      const combined = [...current.transactions, ...next.transactions].sort(
        (a, b) => a.date.localeCompare(b.date)
      );
      const priceChange: StreamEvent = {
        type: "price_change",
        from_amount_dollars: Number(current.median_amount_dollars.toFixed(2)),
        to_amount_dollars: Number(next.median_amount_dollars.toFixed(2)),
        at_date: nextFirst,
      };
      current = {
        // Use next's stats as the current level (latest is current).
        ...next,
        // Drop the band suffix on merchant_key so the merged stream
        // carries the canonical merchant identity.
        merchant_key: stripBandSuffix(current.merchant_key),
        transactions: combined,
        occurrences: combined.length,
        events: [...current.events, ...next.events, priceChange],
        // Preserve rescued flag if either side was rescued — the user
        // should still see that the data was thin somewhere.
        rescued: current.rescued || next.rescued,
        rescue_reason: current.rescue_reason ?? next.rescue_reason,
      };
    }
    merged.push(current);
    out.push(...merged);
  }
  return out;
}

function stripBandSuffix(key: string): string {
  const m = key.match(/^(.+?)__b\d+$/);
  return m ? m[1] : key;
}

function shapeSplit(amountSorted: TxnInput[]): TxnInput[][] {
  if (amountSorted.length <= 2) return [amountSorted];
  const amts = amountSorted.map((t) => Math.abs(t.amount_dollars));
  const gaps: number[] = [];
  for (let i = 1; i < amts.length; i++) gaps.push(amts[i] - amts[i - 1]);
  let maxIdx = 0;
  for (let i = 1; i < gaps.length; i++) {
    if (gaps[i] > gaps[maxIdx]) maxIdx = i;
  }
  const otherGaps = gaps.filter((_, i) => i !== maxIdx);
  if (otherGaps.length === 0) return [amountSorted];
  const otherMedian = median(otherGaps);
  // Avoid div-by-zero when within-cluster amounts are identical.
  const denom =
    otherMedian > 0
      ? otherMedian
      : otherGaps.reduce((s, g) => s + g, 0) / otherGaps.length;
  if (denom <= 0) {
    // Internal gaps all zero. Only split when the break gap is
    // meaningfully non-zero — anything > $1 is a clear tier change
    // here (since amounts were identical otherwise).
    if (gaps[maxIdx] < 1) return [amountSorted];
  } else if (gaps[maxIdx] / denom < SHAPE_SPLIT_THRESHOLD) {
    return [amountSorted];
  }
  const left = amountSorted.slice(0, maxIdx + 1);
  const right = amountSorted.slice(maxIdx + 1);
  return [...shapeSplit(left), ...shapeSplit(right)];
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

// v7 / Problem 7 — Modal cadence inference with multi-period pauses.
//
// Median gap absorbs single outliers but breaks when a stream has
// regular skips (every-other-month pause, vacation gap, mid-window
// suspension). A 30-day stream with a few 90-day skips has median 30
// when skips are minority but median 60+ when skips approach majority,
// which puts the stream into the wrong cadence band or no band.
//
// Modal approach: for each distinct gap value, count how many other
// gaps are direct matches (k=1 within ±20%) vs integer-multiple matches
// (k=2,3,... within ±20% of k×candidate). The candidate that explains
// the most gaps wins; ties go to the SMALLER cadence because skips are
// "pauses on a faster heartbeat" — never the other way around.
//
// Output: chosen cadence + indices of gaps that are integer-multiple
// pauses. Pause-resume events are emitted later from these indices.
//
// Principle: a skipped period is a pause on the modal cadence, not
// evidence against it. The engine MUST never reject a stream solely
// because one period was skipped.
const MODAL_GAP_TOLERANCE = 0.2;
const MODAL_MAX_K = 12;

function inferModalCadence(
  gaps: number[]
): { cadence: number; pauseIndices: number[] } | null {
  if (gaps.length === 0) return null;
  if (gaps.length === 1) return { cadence: gaps[0], pauseIndices: [] };

  // Candidates: every distinct gap value seen.
  const distinct = Array.from(new Set(gaps)).sort((a, b) => a - b);
  let bestCadence = -1;
  let bestScore = -1;
  for (const candidate of distinct) {
    if (candidate <= 0) continue;
    let directHits = 0;
    let multipleHits = 0;
    for (const g of gaps) {
      const k = Math.round(g / candidate);
      if (k < 1 || k > MODAL_MAX_K) continue;
      const expected = k * candidate;
      if (
        Math.abs(g - expected) / Math.max(expected, 1) >
        MODAL_GAP_TOLERANCE
      ) {
        continue;
      }
      if (k === 1) directHits++;
      else multipleHits++;
    }
    if (directHits < 1) continue; // need at least one direct gap
    // Direct hits weighted 1.0, multiples weighted 0.5 (they're
    // explanations but weaker evidence of the cadence itself).
    const score = directHits + multipleHits * 0.5;
    if (
      score > bestScore ||
      (score === bestScore && candidate < bestCadence)
    ) {
      bestScore = score;
      bestCadence = candidate;
    }
  }
  if (bestCadence < 0) return null;

  const pauseIndices: number[] = [];
  for (let i = 0; i < gaps.length; i++) {
    const k = Math.round(gaps[i] / bestCadence);
    if (k >= 2 && k <= MODAL_MAX_K) {
      const expected = k * bestCadence;
      if (
        Math.abs(gaps[i] - expected) / Math.max(expected, 1) <=
        MODAL_GAP_TOLERANCE
      ) {
        pauseIndices.push(i);
      }
    }
  }
  return { cadence: bestCadence, pauseIndices };
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
    // v7 / Problem 6 — buffer the bands' streams so the post-band
    // merge pass can link sequential price levels into one continuing
    // stream instead of emitting parallel old + new bands.
    const merchantPendingStreams: DetectedStream[] = [];
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
    // v7 / Problem 7 — modal cadence with skip-as-pause tolerance.
    // Replaces median-gap. A stream with regular spacing plus a few
    // skipped periods now lands on the right cadence band; the
    // skipped periods become pause_resume events instead of "no
    // cadence" rejections.
    const modal = gaps.length === 0 ? null : inferModalCadence(gaps);
    const medianGap = modal ? modal.cadence : 0;
    const band = modal ? bandFor(modal.cadence, params.cadence_bands) : null;

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
      // v7 / Problem 4 — reject-asymmetry invariant.
      // Brief: "Any group that recurs with regular-or-paused spacing,
      // or matches a generic non-merchant class, MUST exit as confirm
      // or low-confidence review — NEVER a silent reject." The
      // widened rule: ANY group with ≥ 2 kept items rescues as
      // low-confidence review, regardless of cadence band. The
      // classifier then decides — Gate A rejects provable non-
      // merchant (transfers, fees, brokerage); the rest lands on
      // review for the user. Reject is reserved for true isolated
      // one-offs (kept.length < 2) and bottom-up data problems
      // (median_amount_zero, all_drifted).
      const lowConfidenceHit = kept.length >= 2;
      if (registryHit || keywordHit || scheduleHit || lowConfidenceHit) {
        const lastDate = kept[kept.length - 1].date;
        const avg =
          kept.reduce((s, t) => s + Math.abs(t.amount_dollars), 0) /
          kept.length;
        const rescuedFrequency: Cadence = band ?? "MONTHLY";
        const rescuedGap = medianGap || 30;
        merchantPendingStreams.push({
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

    merchantPendingStreams.push({
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

    // v7 / Problem 6 — link sequential price levels into one
    // continuing stream with a price_change event. Concurrent bands
    // (overlapping date ranges) stay as parallel streams. The merged
    // stream's amount = latest level.
    const finalized = mergeSequentialPriceLevels(merchantPendingStreams);
    for (const s of finalized) streams.push(s);
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
