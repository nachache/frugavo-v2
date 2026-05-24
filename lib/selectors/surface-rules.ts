// Surface rules — the single source of truth for which recurring
// tiers appear on which UI surface.
//
// IMPORTANT ARCHITECTURE NOTE
// ────────────────────────────
// Filtering happens BEFORE aggregation. Every aggregate function in
// lib/insights.ts (burn-rate, top, categories, money-leaks, shock
// insights, personality) consumes a tier-filtered slice of
// subscriptions, NOT the raw list. That way:
//
//   - "Filter for display later" inconsistencies cannot happen.
//   - The hero number and the list under it are always derived from
//     the same source.
//   - User feedback that demotes a sub from confirmed_subscription
//     to uncertain instantly flows through every downstream number.
//
// If you find yourself filtering by recurring_type AT THE UI LEVEL,
// stop and add a selector function here instead.

export type TieredSubscription = {
  id: string;
  recurring_type:
    | "confirmed_subscription"
    | "recurring_bill"
    | "recurring_commerce"
    | "uncertain_recurring";
  confidence_score: number;
  status: string;
  classification: string | null;
  // Anything else the caller wants to carry through — the selectors
  // never read additional fields, they just filter by tier + confidence.
  [k: string]: unknown;
};

// ---------------------------------------------------------------------
// Confidence thresholds
// ---------------------------------------------------------------------

// 90+ → safe to surface on hero / onboarding reveal / share card.
export const HERO_CONFIDENCE_FLOOR = 90;
// 75+ → allowed on dashboard list and category math.
export const DASHBOARD_CONFIDENCE_FLOOR = 75;
// 50+ → eligible for the "Possible recurring charges" collapsed
// accordion if (and only if) the user wants to peek under the hood.
export const POSSIBLE_RECURRING_FLOOR = 50;

// ---------------------------------------------------------------------
// Core predicates — every "where should X appear?" question lives here
// ---------------------------------------------------------------------

/**
 * The active, real subscription list the dashboard hero counts and
 * the user thinks of as "things I subscribe to." Excludes bills (those
 * have a separate count) and excludes commerce + uncertain entirely.
 *
 * Used by: onboarding reveal, share card, dashboard hero "you're
 * paying for N services", protection insights, money-leaks.
 */
export function isHeroSubscription(s: TieredSubscription): boolean {
  return (
    s.status === "active" &&
    s.classification === "confirmed" &&
    s.recurring_type === "confirmed_subscription" &&
    s.confidence_score >= DASHBOARD_CONFIDENCE_FLOOR
  );
}

/**
 * Recurring bills (utilities, telecom, insurance, rent). Contribute
 * to the monthly recurring TOTAL but visually rendered separately
 * from subscriptions. Never drive the personality archetype or the
 * onboarding reveal headline.
 *
 * Used by: monthly recurring total, billing-due alerts.
 */
export function isRecurringBill(s: TieredSubscription): boolean {
  return (
    s.status === "active" &&
    s.classification === "confirmed" &&
    s.recurring_type === "recurring_bill" &&
    s.confidence_score >= DASHBOARD_CONFIDENCE_FLOOR
  );
}

/**
 * Recurring commerce — CVS, Sephora, Starbucks, gas stations. The
 * collapsed "Spending patterns we noticed" accordion only. NEVER
 * surfaced anywhere else.
 */
export function isRecurringCommerce(s: TieredSubscription): boolean {
  return (
    s.status === "active" &&
    s.classification === "confirmed" &&
    s.recurring_type === "recurring_commerce" &&
    s.confidence_score >= POSSIBLE_RECURRING_FLOOR
  );
}

/**
 * Possible-recurring catch-all — the user-correctable bucket. Confidence
 * is between 50 and the dashboard floor. The user might recognize one
 * of these and promote it to a subscription, or ignore them entirely.
 */
export function isPossibleRecurring(s: TieredSubscription): boolean {
  return (
    s.status === "active" &&
    s.classification === "confirmed" &&
    s.recurring_type === "uncertain_recurring" &&
    s.confidence_score >= POSSIBLE_RECURRING_FLOOR
  );
}

// ---------------------------------------------------------------------
// Composite selectors used by aggregators
// ---------------------------------------------------------------------

/**
 * Everything that counts toward the monthly recurring obligation
 * TOTAL: subscriptions + bills. Excludes commerce + uncertain.
 *
 * This is the right input for the "your monthly recurring total"
 * headline. NOT for the "you subscribe to N services" headline —
 * that's heroSubscriptions only.
 */
export function recurringObligations<T extends TieredSubscription>(
  subs: T[]
): T[] {
  return subs.filter((s) => isHeroSubscription(s) || isRecurringBill(s));
}

/**
 * Subscriptions only. Drives count + personality + reveal + share card.
 */
export function heroSubscriptions<T extends TieredSubscription>(subs: T[]): T[] {
  return subs.filter(isHeroSubscription);
}

/**
 * Bills only. Drives the secondary "your recurring bills" rail.
 */
export function recurringBills<T extends TieredSubscription>(subs: T[]): T[] {
  return subs.filter(isRecurringBill);
}

/**
 * Commerce only. Drives the collapsed accordion.
 */
export function recurringCommerce<T extends TieredSubscription>(
  subs: T[]
): T[] {
  return subs.filter(isRecurringCommerce);
}

/**
 * Personality archetype input. INTENTIONALLY conservative — must
 * exclude bills, commerce, AND uncertain. Personality should derive
 * from validated, recognizable subscriptions only, never from sparse
 * data or noisy commerce.
 *
 * Per Constraint #6 in the trust-rebuild brief: personality should
 * "activate only from validated subscriptions, meaningful recurring
 * patterns, high-confidence signals. Otherwise it feels fabricated."
 */
export function personalityInputs<T extends TieredSubscription>(subs: T[]): T[] {
  return subs.filter(
    (s) =>
      isHeroSubscription(s) && s.confidence_score >= HERO_CONFIDENCE_FLOOR - 5
  );
}

/**
 * Onboarding reveal input. Same as personality — credibility-first.
 *
 * Per Constraint #4: "the reveal must feel believable, recognizable,
 * trustworthy. A smaller believable total converts better than an
 * inflated total contaminated by CVS and restaurants."
 */
export function revealInputs<T extends TieredSubscription>(subs: T[]): T[] {
  return subs.filter(
    (s) => isHeroSubscription(s) || isRecurringBill(s)
  );
}
