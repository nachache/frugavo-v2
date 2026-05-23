// Pure detector functions for Peace of Mind monitoring.
//
// Each detector takes a current scan snapshot (and sometimes a prior
// snapshot, and/or per-merchant charge history) and returns a list of
// CandidateAlert objects. The functions have NO I/O — every input is
// passed in, every output is in memory. This makes them trivially
// testable and replayable.
//
// dedup_key conventions live with each detector. The orchestrator
// upserts on (user_id, dedup_key) so re-running on the same data
// produces no duplicates.

import type { SnapshotRow } from "@/lib/types/snapshot";
import type { CandidateAlert } from "./types";

const PRICE_INCREASE_THRESHOLD = 0.05;       // ≥5% bump → alert
const RENEWAL_LOOKAHEAD_DAYS = 5;            // alert N days before
const DORMANT_THRESHOLD_DAYS = 90;           // quiet for this long
const DORMANT_RECENT_WINDOW_DAYS = 14;       // back within last N days
const HIGH_CHARGE_MULTIPLIER = 1.8;          // ≥1.8× median → flag
const TRIAL_MAX_CENTS = 100;                 // ≤$1.00 = trial charge
const TRIAL_LOOKBACK_DAYS = 60;              // trial happened within N days
const TRIAL_CONVERSION_MULT = 4;             // paid ≥ 4× trial → real conversion
const TRIAL_RECENT_WINDOW_DAYS = 7;          // alert only when conversion is fresh
const MISSING_RENEWAL_GRACE_DAYS = 3;        // wait N days past expected
const MISSING_RENEWAL_MAX_LATE_DAYS = 21;    // give up after N days (cancelled)

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// ───────────────────────────────────────────────────────────────────
// 1. New subscription
//
// Subs present in CURRENT scan but not in PRIOR. Classification must
// be 'confirmed' on the current row — we don't alert on uncertain
// detections.
// ───────────────────────────────────────────────────────────────────

export function detectNewSubscriptions(args: {
  current: SnapshotRow[];
  prior: SnapshotRow[] | null;
}): CandidateAlert[] {
  const { current, prior } = args;
  if (!prior) {
    // First scan ever — nothing is "new" relative to nothing. We
    // intentionally skip generating new-sub alerts on first scan so
    // the user isn't blasted with N notifications on signup.
    return [];
  }
  const priorIds = new Set(prior.map((r) => r.plaid_stream_id));
  const out: CandidateAlert[] = [];
  for (const sub of current) {
    if (sub.classification !== "confirmed") continue;
    if (priorIds.has(sub.plaid_stream_id)) continue;
    out.push({
      alert_type: "new_subscription",
      severity: "notice",
      dedup_key: `new_sub:${sub.plaid_stream_id}`,
      subscription_id: null, // resolved by orchestrator via stream_id lookup
      merchant_key: null,
      merchant_name: sub.merchant_name,
      details: {
        plaid_stream_id: sub.plaid_stream_id,
        amount_cents: sub.amount_cents,
        currency: sub.currency,
        frequency: sub.frequency,
        category: sub.category,
        first_seen_at: sub.last_charged_at,
        headline: `New subscription detected: ${sub.merchant_name}`,
        sub_line: `${fmtMoney(sub.monthly_equivalent_cents)}/mo · ${sub.category}`,
      },
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────
// 2. Price increase
//
// Same plaid_stream_id present in both scans with current amount
// ≥ prior amount × 1.05. The dedup_key encodes the actual delta so
// a second hike (e.g. $9.99 → $11.99 → $14.99) generates a SECOND
// alert rather than collapsing into the first.
// ───────────────────────────────────────────────────────────────────

export function detectPriceIncreases(args: {
  current: SnapshotRow[];
  prior: SnapshotRow[] | null;
}): CandidateAlert[] {
  const { current, prior } = args;
  if (!prior) return [];
  const priorById = new Map(prior.map((r) => [r.plaid_stream_id, r]));
  const out: CandidateAlert[] = [];
  for (const sub of current) {
    if (sub.classification !== "confirmed") continue;
    const p = priorById.get(sub.plaid_stream_id);
    if (!p || p.amount_cents <= 0) continue;
    const ratio = sub.amount_cents / p.amount_cents;
    if (ratio < 1 + PRICE_INCREASE_THRESHOLD) continue;
    const pctDelta = Math.round((ratio - 1) * 100);
    out.push({
      alert_type: "price_increase",
      severity: pctDelta >= 25 ? "urgent" : "notice",
      dedup_key: `price_inc:${sub.plaid_stream_id}:${p.amount_cents}->${sub.amount_cents}`,
      merchant_name: sub.merchant_name,
      details: {
        plaid_stream_id: sub.plaid_stream_id,
        from_cents: p.amount_cents,
        to_cents: sub.amount_cents,
        delta_pct: pctDelta,
        frequency: sub.frequency,
        headline: `${sub.merchant_name} went up ${pctDelta}%`,
        sub_line: `${fmtMoney(p.amount_cents)} → ${fmtMoney(sub.amount_cents)}`,
      },
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────
// 3. Renewal upcoming
//
// Confirmed sub with next_expected_charge_at between now and now+N
// days. Dedup_key includes the date so each renewal cycle fires
// at most one alert.
// ───────────────────────────────────────────────────────────────────

export function detectUpcomingRenewals(args: {
  current: SnapshotRow[];
  asOf: Date;
}): CandidateAlert[] {
  const { current, asOf } = args;
  const out: CandidateAlert[] = [];
  const cutoffMs = asOf.getTime() + RENEWAL_LOOKAHEAD_DAYS * 86_400_000;
  for (const sub of current) {
    if (sub.classification !== "confirmed") continue;
    if (sub.status !== "active") continue;
    if (!sub.next_expected_charge_at) continue;
    const next = new Date(sub.next_expected_charge_at).getTime();
    if (next < asOf.getTime()) continue;
    if (next > cutoffMs) continue;
    const daysOut = Math.max(
      0,
      Math.round((next - asOf.getTime()) / 86_400_000)
    );
    const dateStr = sub.next_expected_charge_at.slice(0, 10);
    out.push({
      alert_type: "renewal_upcoming",
      severity: "info",
      dedup_key: `renewal:${sub.plaid_stream_id}:${dateStr}`,
      merchant_name: sub.merchant_name,
      details: {
        plaid_stream_id: sub.plaid_stream_id,
        renewal_date: dateStr,
        amount_cents: sub.amount_cents,
        days_until: daysOut,
        headline:
          daysOut === 0
            ? `${sub.merchant_name} renews today`
            : daysOut === 1
              ? `${sub.merchant_name} renews tomorrow`
              : `${sub.merchant_name} renews in ${daysOut} days`,
        sub_line: `${fmtMoney(sub.amount_cents)} on ${dateStr}`,
      },
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────
// 4. Dormant subscription resumed
//
// A merchant_key that had NO accepted charges for DORMANT_THRESHOLD
// days then DID charge within the last DORMANT_RECENT_WINDOW days.
// Catches: "I cancelled my gym in January, why am I being charged
// again in June?"
//
// chargeHistoryByMerchant: full subscription_charges rows grouped by
// merchant_key, accepted only, ascending by posted_date.
// ───────────────────────────────────────────────────────────────────

export function detectDormantResumed(args: {
  current: SnapshotRow[];
  chargeHistoryByMerchant: Map<string, { posted_date: string; amount_cents: number }[]>;
  asOf: Date;
}): CandidateAlert[] {
  const { current, chargeHistoryByMerchant, asOf } = args;
  const out: CandidateAlert[] = [];
  const recentCutoff = new Date(asOf);
  recentCutoff.setDate(recentCutoff.getDate() - DORMANT_RECENT_WINDOW_DAYS);
  const recentCutoffIso = recentCutoff.toISOString().slice(0, 10);
  const dormantBoundary = new Date(asOf);
  dormantBoundary.setDate(dormantBoundary.getDate() - DORMANT_THRESHOLD_DAYS);
  const dormantBoundaryIso = dormantBoundary.toISOString().slice(0, 10);

  for (const sub of current) {
    if (sub.classification !== "confirmed") continue;
    // SnapshotRow doesn't carry merchant_key explicitly; we look it
    // up using plaid_stream_id → caller must build the history map
    // keyed by the same identifier the snapshot uses. The orchestrator
    // joins on plaid_transactions.merchant_key, which matches the
    // engine's grouping identity. Snapshot uses plaid_stream_id which
    // is the subscription_key — already aligned by design.
    const history = chargeHistoryByMerchant.get(sub.plaid_stream_id);
    if (!history || history.length < 2) continue;
    // Find the FIRST charge after the dormancy gap.
    let firstResumed: { posted_date: string; amount_cents: number } | null = null;
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      if (curr.posted_date < dormantBoundaryIso) continue;
      // Days between prev and curr.
      const prevMs = new Date(prev.posted_date).getTime();
      const currMs = new Date(curr.posted_date).getTime();
      const gapDays = (currMs - prevMs) / 86_400_000;
      if (gapDays >= DORMANT_THRESHOLD_DAYS) {
        firstResumed = curr;
        break;
      }
    }
    if (!firstResumed) continue;
    if (firstResumed.posted_date < recentCutoffIso) continue;
    out.push({
      alert_type: "dormant_resumed",
      severity: "urgent",
      dedup_key: `dormant:${sub.plaid_stream_id}:${firstResumed.posted_date}`,
      merchant_name: sub.merchant_name,
      details: {
        plaid_stream_id: sub.plaid_stream_id,
        resumed_date: firstResumed.posted_date,
        amount_cents: firstResumed.amount_cents,
        headline: `${sub.merchant_name} charged you again after a long break`,
        sub_line: `${fmtMoney(firstResumed.amount_cents)} on ${firstResumed.posted_date} — last seen ${DORMANT_THRESHOLD_DAYS}+ days ago`,
      },
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────
// 5. Unusually high charge
//
// Surfaces accepted charges (in the last 7 days) whose amount is
// HIGH_CHARGE_MULTIPLIER × the median for that merchant. Captures
// "Netflix charged $32 this month instead of $14.99."
//
// recentOutlierCharges: rows from subscription_charges where
// detector_status='outlier' AND posted_date in last 7 days.
// medianByMerchant: median accepted amount per plaid_stream_id.
// ───────────────────────────────────────────────────────────────────

export function detectHighCharges(args: {
  outlierCharges: {
    plaid_transaction_id: string;
    subscription_id: string;
    merchant_key: string | null;
    merchant_name: string;
    posted_date: string;
    amount_cents: number;
  }[];
  medianByMerchant: Map<string, number>;
}): CandidateAlert[] {
  const { outlierCharges, medianByMerchant } = args;
  const out: CandidateAlert[] = [];
  for (const c of outlierCharges) {
    const merchantKey = c.merchant_key ?? "";
    const median = medianByMerchant.get(merchantKey);
    if (!median || median <= 0) continue;
    const ratio = c.amount_cents / median;
    if (ratio < HIGH_CHARGE_MULTIPLIER) continue;
    const pctDelta = Math.round((ratio - 1) * 100);
    out.push({
      alert_type: "high_charge_amount",
      severity: ratio >= 3 ? "urgent" : "notice",
      dedup_key: `high_charge:${c.plaid_transaction_id}`,
      subscription_id: c.subscription_id,
      merchant_key: c.merchant_key,
      merchant_name: c.merchant_name,
      details: {
        plaid_transaction_id: c.plaid_transaction_id,
        amount_cents: c.amount_cents,
        median_cents: median,
        delta_pct: pctDelta,
        posted_date: c.posted_date,
        headline: `Unusual charge: ${c.merchant_name} ${fmtMoney(c.amount_cents)}`,
        sub_line: `${pctDelta}% above your typical ${fmtMoney(median)}`,
      },
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────
// 6. Trial expiration / conversion
//
// Looks for the classic trial pattern in subscription_charges history:
// a $0.00 or very-low-cents authorization from a merchant followed by
// a full-price recurring charge from the same merchant within the
// trial-lookback window. When we see the conversion within the last
// TRIAL_RECENT_WINDOW days we fire a fresh urgent alert.
//
// We don't require a catalog flag — any merchant that exhibits the
// pattern is treated as a trial. The "paid ≥ 4× trial" multiplier
// guards against false positives where the same merchant authorizes
// $0.99 and $1.49 (e.g. partial credits, not trial vs paid).
//
// chargeHistoryByMerchant is keyed by plaid_stream_id (= subscription_
// key) — the same map already built for dormant detection.
// ───────────────────────────────────────────────────────────────────

export function detectTrialConversions(args: {
  chargeHistoryByMerchant: Map<
    string,
    { posted_date: string; amount_cents: number }[]
  >;
  asOf: Date;
}): CandidateAlert[] {
  const { chargeHistoryByMerchant, asOf } = args;
  const out: CandidateAlert[] = [];
  const lookbackMs = TRIAL_LOOKBACK_DAYS * 86_400_000;
  const recentMs = TRIAL_RECENT_WINDOW_DAYS * 86_400_000;
  const asOfMs = asOf.getTime();

  for (const [streamId, history] of chargeHistoryByMerchant) {
    if (history.length < 2) continue;
    // Find the first low-cents charge.
    const trialIdx = history.findIndex(
      (h) => h.amount_cents > 0 && h.amount_cents <= TRIAL_MAX_CENTS
    );
    if (trialIdx === -1) continue;
    const trial = history[trialIdx];
    // Find the next-following full-price charge within the lookback.
    let paid: { posted_date: string; amount_cents: number } | null = null;
    for (let i = trialIdx + 1; i < history.length; i++) {
      const c = history[i];
      if (c.amount_cents < trial.amount_cents * TRIAL_CONVERSION_MULT) continue;
      const dtMs = new Date(c.posted_date).getTime() - new Date(trial.posted_date).getTime();
      if (dtMs > lookbackMs) break;
      paid = c;
      break;
    }
    if (!paid) continue;
    // Only fire when the conversion is fresh (last week-ish).
    if (asOfMs - new Date(paid.posted_date).getTime() > recentMs) continue;

    out.push({
      alert_type: "trial_converting",
      severity: "urgent",
      dedup_key: `trial:${streamId}:${paid.posted_date}`,
      details: {
        plaid_stream_id: streamId,
        trial_date: trial.posted_date,
        trial_cents: trial.amount_cents,
        paid_date: paid.posted_date,
        paid_cents: paid.amount_cents,
        headline: `Your free trial just turned into a paid charge`,
        sub_line: `${fmtMoney(paid.amount_cents)} charged on ${paid.posted_date} after a ${fmtMoney(trial.amount_cents)} trial`,
      },
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────
// 7. Missing renewal
//
// A confirmed active subscription whose next_expected_charge_at is
// 3-21 days in the past with no matching charge in the snapshot.
// Could mean: (a) merchant billing failure, (b) user cancelled and
// forgot to tell us, (c) timing drift. Notice severity — we don't
// know which, but the user should know.
//
// The 21-day upper bound prevents lingering alerts on subscriptions
// that have plainly been cancelled — after 21 days late we let the
// dormant-resumed detector take over if they ever come back.
// ───────────────────────────────────────────────────────────────────

export function detectMissingRenewals(args: {
  current: SnapshotRow[];
  asOf: Date;
}): CandidateAlert[] {
  const { current, asOf } = args;
  const out: CandidateAlert[] = [];
  const asOfMs = asOf.getTime();
  const graceMs = MISSING_RENEWAL_GRACE_DAYS * 86_400_000;
  const maxLateMs = MISSING_RENEWAL_MAX_LATE_DAYS * 86_400_000;

  for (const sub of current) {
    if (sub.classification !== "confirmed") continue;
    if (sub.status !== "active") continue;
    if (!sub.next_expected_charge_at) continue;
    const nextMs = new Date(sub.next_expected_charge_at).getTime();
    if (nextMs >= asOfMs) continue;
    const lateMs = asOfMs - nextMs;
    if (lateMs < graceMs) continue;
    if (lateMs > maxLateMs) continue;
    const lateDays = Math.round(lateMs / 86_400_000);
    const expectedDate = sub.next_expected_charge_at.slice(0, 10);
    out.push({
      alert_type: "missing_renewal",
      severity: "notice",
      // Dedup on the expected date — we'll fire one alert per missed
      // cycle. If the user re-confirms the sub and a new cycle is
      // expected later, that next-expected date generates its own key.
      dedup_key: `missing_renewal:${sub.plaid_stream_id}:${expectedDate}`,
      merchant_name: sub.merchant_name,
      details: {
        plaid_stream_id: sub.plaid_stream_id,
        expected_date: expectedDate,
        late_days: lateDays,
        amount_cents: sub.amount_cents,
        headline: `${sub.merchant_name} didn't renew this cycle`,
        sub_line: `Expected ${fmtMoney(sub.amount_cents)} on ${expectedDate} — ${lateDays} day${lateDays === 1 ? "" : "s"} late`,
      },
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────
// 8. Duplicate subscription
//
// Two or more confirmed active subscriptions whose merchant_name
// normalizes to the same root. Captures "you have a personal Dropbox
// and a work Dropbox" or two Spotify accounts. We use the lowercased
// merchant name's first word as a rough key — the engine's stronger
// merchant_normalize step has already collapsed everything that
// reliably matches, so anything left here is a genuine duplicate at
// the merchant-display level.
//
// One alert per duplicate group, anchored on the cheapest sub (so
// the dedup_key is stable across scans even if amounts shift).
// ───────────────────────────────────────────────────────────────────

export function detectDuplicateSubscriptions(args: {
  current: SnapshotRow[];
}): CandidateAlert[] {
  const { current } = args;
  const groups = new Map<string, SnapshotRow[]>();
  for (const sub of current) {
    if (sub.classification !== "confirmed") continue;
    if (sub.status !== "active") continue;
    if (!sub.merchant_name) continue;
    const root = sub.merchant_name
      .toLowerCase()
      .trim()
      .split(/[\s*\-]+/)[0]
      ?.replace(/[^a-z0-9]/g, "");
    if (!root || root.length < 3) continue;
    const arr = groups.get(root) ?? [];
    arr.push(sub);
    groups.set(root, arr);
  }
  const out: CandidateAlert[] = [];
  for (const [root, subs] of groups) {
    if (subs.length < 2) continue;
    const sorted = [...subs].sort((a, b) => a.plaid_stream_id.localeCompare(b.plaid_stream_id));
    const totalCents = sorted.reduce((a, s) => a + s.monthly_equivalent_cents, 0);
    const names = Array.from(new Set(sorted.map((s) => s.merchant_name))).join(", ");
    out.push({
      alert_type: "duplicate_subscription",
      severity: "urgent",
      dedup_key: `duplicate:${root}:${sorted.map((s) => s.plaid_stream_id).join("|")}`,
      merchant_name: sorted[0].merchant_name,
      details: {
        root,
        plaid_stream_ids: sorted.map((s) => s.plaid_stream_id),
        count: sorted.length,
        combined_monthly_cents: totalCents,
        merchant_names: names,
        headline: `You're paying for ${sorted.length} ${sorted[0].merchant_name} subscriptions`,
        sub_line: `${fmtMoney(totalCents)}/mo combined · ${names}`,
      },
    });
  }
  return out;
}
