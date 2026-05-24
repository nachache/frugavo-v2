// Merchant-category priors.
//
// Maps Plaid Personal Finance Category (PFC) tags to a log-odds shift
// per recurring-type tier. This is the ONLY hand-curated knowledge in
// the classifier — and it lives at the CATEGORY level, not the
// merchant level. We never hardcode "Netflix is a subscription"
// because (a) the catalog can already do that with positive evidence,
// and (b) merchant-level whitelists make the model un-correctable
// when Plaid changes its mind about what a merchant is.
//
// The PFC taxonomy is documented at:
// https://plaid.com/docs/api/products/transactions/#personal-finance-category-taxonomy
//
// Output shape per category:
//   { confirmed_subscription, recurring_bill, recurring_commerce }
// where each value is the log-odds shift applied to that tier's
// posterior. Larger positive = stronger evidence for that tier.
// Negative = evidence against. Tiers without an entry default to 0.
//
// Calibration intuition for the magnitudes used below:
//   +2.0 = "Almost certainly this tier" (ENTERTAINMENT.SUBSCRIPTIONS
//           is what Plaid tags Netflix, Spotify, Hulu, Disney+, etc.)
//   +1.5 = "Strong fit"
//   +1.0 = "Plausible default"
//   -1.0 = "Probably not this tier"
//   -2.0 = "Almost certainly not this tier"
//
// uncertain_recurring is computed by the classifier as a residual —
// it's what's left when no tier crosses the surfacing threshold.

export type TierShift = {
  confirmed_subscription?: number;
  recurring_bill?: number;
  recurring_commerce?: number;
};

// Indexed by PFC primary key. Detailed-level overrides defined below
// take precedence when both match.
const PFC_PRIMARY_PRIORS: Record<string, TierShift> = {
  // Streaming / SaaS / consumer subscriptions live here.
  ENTERTAINMENT: {
    confirmed_subscription: +1.5,
    recurring_commerce: -1.0,
  },
  // Utilities, internet, phone, water, gas. Recurring obligations.
  RENT_AND_UTILITIES: {
    recurring_bill: +2.0,
    confirmed_subscription: -0.5,
    recurring_commerce: -2.0,
  },
  // Generic services — gym, software-as-a-service, professional
  // services. Plaid uses this bucket loosely; lean subscription but
  // weakly.
  GENERAL_SERVICES: {
    confirmed_subscription: +0.8,
    recurring_bill: +0.3,
    recurring_commerce: -0.5,
  },
  // Insurance providers (auto, health, home, life).
  TRANSPORTATION: {
    // TRANSPORTATION as a primary mostly catches gas/transit/parking
    // — recurring commerce, not subscriptions. The .DETAILED override
    // for taxi/rideshare further pushes it down.
    recurring_commerce: +1.5,
    confirmed_subscription: -2.0,
    recurring_bill: -1.0,
  },
  // Food and drink — restaurants, coffee, food delivery, groceries.
  // The single biggest source of false-positive "subscriptions"
  // (Starbucks every morning, lunch place every Tuesday).
  FOOD_AND_DRINK: {
    // Softened slightly. Restaurants/coffee are still strongly
    // commerce but a known sub like a meal-kit service or HelloFresh
    // shouldn't be impossible to classify correctly.
    recurring_commerce: +1.5,
    confirmed_subscription: -1.5,
    recurring_bill: -1.5,
  },
  // Pharmacies, grocery stores, big-box retail. CVS, Walgreens,
  // Whole Foods, Walmart, Target, Sephora, Home Depot, Best Buy.
  GENERAL_MERCHANDISE: {
    // Softened from +2.0/-2.5 to +1.0/-0.8. GENERAL_MERCHANDISE
    // catches Amazon (which sells Amazon Prime as a subscription)
    // and Apple (which sells iCloud as a subscription). PFC at this
    // level should NUDGE, not overpower the engine's dictionary +
    // pattern signal.
    recurring_commerce: +1.0,
    confirmed_subscription: -0.8,
    recurring_bill: -1.0,
  },
  // Beauty, salons, gyms, fitness studios. Mixed bag — pure salon
  // visits are commerce, gym memberships are subscriptions. Slightly
  // positive on subscription, the detailed-level override for GYM
  // pushes it further.
  PERSONAL_CARE: {
    confirmed_subscription: +0.3,
    recurring_commerce: +0.5,
  },
  // Medical / dental / health insurance premiums.
  MEDICAL: {
    recurring_bill: +1.0,
    recurring_commerce: +0.5,
    confirmed_subscription: -0.5,
  },
  // Government, education, taxes, charity. Mostly internal-only
  // recurring obligations or one-off.
  GOVERNMENT_AND_NON_PROFIT: {
    recurring_bill: +0.5,
    confirmed_subscription: -1.0,
    recurring_commerce: -1.0,
  },
  // Anything PFC didn't categorize. Stay neutral.
  OTHER: {},
  // Hard denials — these are caught by Gate A as rejects, but defensive
  // priors here ensure that if anything slips through, it does not get
  // promoted to a subscription.
  TRANSFER_IN: {
    confirmed_subscription: -3.0,
    recurring_bill: -3.0,
    recurring_commerce: -3.0,
  },
  TRANSFER_OUT: {
    confirmed_subscription: -3.0,
    recurring_bill: -3.0,
    recurring_commerce: -3.0,
  },
  LOAN_PAYMENTS: {
    recurring_bill: +1.5,
    confirmed_subscription: -2.0,
    recurring_commerce: -2.0,
  },
  BANK_FEES: {
    recurring_bill: +0.5,
    confirmed_subscription: -1.5,
    recurring_commerce: -1.5,
  },
  INCOME: {
    confirmed_subscription: -3.0,
    recurring_bill: -3.0,
    recurring_commerce: -3.0,
  },
  TAX: {
    recurring_bill: +0.5,
    confirmed_subscription: -2.0,
    recurring_commerce: -2.0,
  },
};

// PFC detailed-level overrides. Applied IN ADDITION to the primary
// prior. Most useful for splitting heterogeneous primaries like
// PERSONAL_CARE (gym vs salon) and TRANSPORTATION (gas vs car wash
// subscription).
const PFC_DETAILED_PRIORS: Record<string, TierShift> = {
  ENTERTAINMENT_TV_AND_MOVIES: {
    confirmed_subscription: +1.0, // Netflix, Hulu, Disney+
  },
  ENTERTAINMENT_MUSIC_AND_AUDIO: {
    confirmed_subscription: +1.0, // Spotify, Apple Music, Pandora
  },
  ENTERTAINMENT_VIDEO_GAMES: {
    confirmed_subscription: +0.5, // PlayStation Plus, Xbox, Steam
  },
  GENERAL_SERVICES_INSURANCE: {
    recurring_bill: +1.5,
    confirmed_subscription: -0.5,
  },
  GENERAL_SERVICES_TELECOMMUNICATION_SERVICES: {
    recurring_bill: +1.0,
    confirmed_subscription: +0.5, // Verizon, T-Mobile, Comcast
  },
  GENERAL_SERVICES_STORAGE: {
    confirmed_subscription: +0.5,
  },
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: {
    recurring_bill: +1.0,
    confirmed_subscription: +0.5,
  },
  RENT_AND_UTILITIES_TELEPHONE: {
    recurring_bill: +1.0,
  },
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: {
    recurring_bill: +1.5,
  },
  RENT_AND_UTILITIES_WATER: {
    recurring_bill: +1.0,
  },
  RENT_AND_UTILITIES_RENT: {
    recurring_bill: +1.5,
  },
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: {
    confirmed_subscription: +1.5, // gym memberships
    recurring_commerce: -1.0,
  },
  PERSONAL_CARE_HAIR_AND_BEAUTY: {
    recurring_commerce: +1.0, // salons, barbers
    confirmed_subscription: -1.0,
  },
  TRANSPORTATION_GAS: {
    recurring_commerce: +1.5,
    confirmed_subscription: -1.5,
  },
  TRANSPORTATION_PUBLIC_TRANSIT: {
    recurring_commerce: +1.0,
    confirmed_subscription: -0.5,
  },
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: {
    recurring_commerce: +1.5,
    confirmed_subscription: -1.5,
  },
  TRANSPORTATION_PARKING: {
    recurring_commerce: +1.0,
  },
  FOOD_AND_DRINK_RESTAURANT: {
    recurring_commerce: +1.5,
    confirmed_subscription: -1.5,
  },
  FOOD_AND_DRINK_FAST_FOOD: {
    recurring_commerce: +1.5,
    confirmed_subscription: -1.5,
  },
  FOOD_AND_DRINK_COFFEE: {
    recurring_commerce: +1.5,
    confirmed_subscription: -1.5,
  },
  FOOD_AND_DRINK_GROCERIES: {
    recurring_commerce: +2.0,
    confirmed_subscription: -2.0,
  },
  GENERAL_MERCHANDISE_PHARMACIES_AND_CONVENIENCE_STORES: {
    recurring_commerce: +1.5,
    confirmed_subscription: -1.5,
  },
  GENERAL_MERCHANDISE_SUPERSTORES: {
    recurring_commerce: +1.5,
    confirmed_subscription: -1.5,
  },
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: {
    recurring_commerce: +1.0,
    confirmed_subscription: -1.0,
  },
  GENERAL_MERCHANDISE_DISCOUNT_STORES: {
    recurring_commerce: +1.0,
    confirmed_subscription: -1.0,
  },
  GENERAL_MERCHANDISE_HARDWARE_STORES: {
    recurring_commerce: +1.0,
    confirmed_subscription: -1.0,
  },
  // Streaming services Plaid sometimes tags as general subscriptions
  // rather than ENTERTAINMENT.* — fall back to a soft positive.
  ENTERTAINMENT_SUBSCRIPTIONS: {
    confirmed_subscription: +1.5,
  },
};

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------

export type RecurringTier =
  | "confirmed_subscription"
  | "recurring_bill"
  | "recurring_commerce";

/**
 * Returns the log-odds shifts for each tier given PFC tags.
 * Both arguments are optional; missing tags return all-zero shifts.
 *
 * Primary + detailed shifts are ADDED, so the detailed override is
 * additive on top of the primary. This means a (FOOD_AND_DRINK,
 * FOOD_AND_DRINK_GROCERIES) charge gets +2.0 + +2.0 = +4.0 for
 * recurring_commerce, and -2.5 + -2.0 = -4.5 for confirmed_subscription.
 * That's intentional — groceries are an extremely strong commerce
 * signal and the additive design lets the detailed level push harder
 * when present.
 */
export function categoryPrior(
  pfcPrimary?: string | null,
  pfcDetailed?: string | null
): Record<RecurringTier, number> {
  const out: Record<RecurringTier, number> = {
    confirmed_subscription: 0,
    recurring_bill: 0,
    recurring_commerce: 0,
  };
  if (pfcPrimary) {
    const p = PFC_PRIMARY_PRIORS[pfcPrimary.toUpperCase()];
    if (p) addShifts(out, p);
  }
  if (pfcDetailed) {
    const d = PFC_DETAILED_PRIORS[pfcDetailed.toUpperCase()];
    if (d) addShifts(out, d);
  }
  return out;
}

function addShifts(
  acc: Record<RecurringTier, number>,
  delta: TierShift
): void {
  if (delta.confirmed_subscription !== undefined)
    acc.confirmed_subscription += delta.confirmed_subscription;
  if (delta.recurring_bill !== undefined)
    acc.recurring_bill += delta.recurring_bill;
  if (delta.recurring_commerce !== undefined)
    acc.recurring_commerce += delta.recurring_commerce;
}

/**
 * Returns the tier with the highest log-odds shift, given PFC tags.
 * Returns null if no PFC info available OR if all tiers are zero
 * (caller should fall back to other signals like detector regularity).
 */
export function dominantTierFromPfc(
  pfcPrimary?: string | null,
  pfcDetailed?: string | null
): { tier: RecurringTier; shift: number } | null {
  const p = categoryPrior(pfcPrimary, pfcDetailed);
  let best: { tier: RecurringTier; shift: number } | null = null;
  for (const tier of [
    "confirmed_subscription",
    "recurring_bill",
    "recurring_commerce",
  ] as RecurringTier[]) {
    const s = p[tier];
    if (s > 0 && (!best || s > best.shift)) best = { tier, shift: s };
  }
  return best;
}
