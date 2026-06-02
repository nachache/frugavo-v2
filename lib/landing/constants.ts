// Landing-page single source of truth.
//
// Everything user-facing on the marketing site that names a dollar
// figure, a time-to-value, or a sourced claim reads from this file.
// Ad creatives MUST be standardized to these same numbers — if you
// change a value here, update the corresponding ad copy.
//
// Created 2026-06-02 to reconcile inconsistencies that crept in
// across hero copy, /app/connect copy, ad creatives, and email
// subjects.

/**
 * The dollar story.
 *
 * TWO reconciled figures from the same C+R Research 2026 study:
 *
 *   household.annualUsd        $1,847/yr — total subscription bill of
 *                              the average American household. This
 *                              is the X-creative number ($1,847 in
 *                              serif italic on cream) that drove the
 *                              viral post (82K views).
 *
 *   forgotten.monthlyTotalUsd  $42/mo TOTAL — the dollar amount the
 *                              average household pays for the 3-5
 *                              subscriptions they have forgotten about
 *                              and don't actively use. This is a
 *                              SUBSET of household.annualUsd, not a
 *                              per-charge figure.
 *
 * Always state the math when the page uses both numbers so visitors
 * don't have to reconcile them: "$1,847/yr in subscriptions; about
 * $42/mo of it is for 3-5 charges most people don't realize they're
 * paying for."
 */
export const LANDING = {
  household: {
    annualUsd: 1847,
    monthlyUsd: 154,
  },
  forgotten: {
    countMin: 3,
    countMax: 5,
    monthlyTotalUsd: 42,
    annualTotalUsd: 504,
  },
  source: "C+R Research, 2026",
  // Time-to-value standardized to 60 seconds to match live ad
  // creatives. Was previously 30 seconds in hero copy.
  timeToValue: {
    seconds: 60,
    display: "60 seconds",
  },
  banks: {
    count: 11_000,
    display: "11,000+",
  },
  // Trust-signal brands we name-drop in the Plaid strip. These are
  // household-name fintechs that use Plaid; borrowing their familiarity
  // is the highest-leverage credibility move for a small-followers brand.
  plaidPartners: ["Robinhood", "Venmo"] as const,
  // Consolidated trust copy. Previous hero stated "safe" four overlapping
  // ways: Read-only access / We never store banking credentials /
  // Powered by Plaid / Same security as Robinhood & Venmo — plus a
  // duplicate "Powered by Plaid · 11,000+ banks" row. Each idea now
  // appears ONCE: this single line replaces all four checkmarks plus
  // the duplicate Plaid row. The lock badge near the CTA and the
  // Robinhood/Venmo caption do separate jobs and stay distinct.
  trustLine:
    "Bank-grade security, powered by Plaid · read-only · we never store your credentials",
  // Bank-logo placeholders (R4). Abstract pill badges with brand colors
  // and 2-letter initials to read as "we connect to all major banks"
  // without exposing us to trademark concerns. Real wordmarks can be
  // swapped in once brand-usage permission is confirmed.
  bankPlaceholders: [
    { id: "chase",   label: "CH", color: "#117ACA", country: "us" },
    { id: "bofa",    label: "BA", color: "#E61030", country: "us" },
    { id: "wells",   label: "WF", color: "#D71E28", country: "us" },
    { id: "td",      label: "TD", color: "#00805B", country: "ca" },
    { id: "rbc",     label: "RB", color: "#006AC3", country: "ca" },
    { id: "bmo",     label: "BM", color: "#0079C1", country: "ca" },
  ] as const,
  // Currency — defaulting to USD with explicit suffix because ads run
  // US + Canada and geo-aware currency is bigger lift than scope allows.
  currency: "USD" as const,
} as const;

/**
 * Per-channel hero copy variants. Selected via the `?v=` URL param.
 *
 * Every variant reuses the same dollar figures and time-to-value from
 * LANDING above — variants control HEADLINE and SUBHEADLINE only,
 * never the underlying claims.
 *
 * Defined variants:
 *   default    — the unbranded forgotten-subscriptions hook
 *   mint       — for ex-Mint users (Mint sunset March 2024; Credit
 *                Karma replaced it but dropped subscription tracking)
 *   cancel     — search intent "cancel subscriptions"
 *   tracker    — search intent "subscription tracker"
 *   find       — search intent "find subscriptions I forgot"
 *   competitor — alternative-to searches (Rocket Money, Truebill, etc.)
 *
 * Unknown / missing param falls back to `default`. Keep keys short
 * and lowercase — they appear in URLs.
 */
export type VariantKey =
  | "default"
  | "mint"
  | "cancel"
  | "tracker"
  | "find"
  | "competitor";

export type HeroVariant = {
  headline: string;
  subheadline: string;
  // Optional eyebrow override. Most variants inherit the default
  // "Founder Access" badge; some need to acknowledge the channel
  // context (e.g. mint variant calls out the Mint sunset).
  eyebrow?: string;
};

export const HERO_VARIANTS: Record<VariantKey, HeroVariant> = {
  default: {
    headline: "You're probably paying for subscriptions you've forgotten about.",
    subheadline:
      `Most people miss ${LANDING.forgotten.countMin}–${LANDING.forgotten.countMax} recurring charges — about $${LANDING.forgotten.monthlyTotalUsd}/mo in total. See every one in ${LANDING.timeToValue.display}.`,
  },
  mint: {
    eyebrow: "For Mint refugees · Open during early access",
    headline:
      "Mint is gone. Credit Karma doesn't track subscriptions. Frugavo does.",
    subheadline:
      `Find every recurring charge on your statement in ${LANDING.timeToValue.display}. Read-only via Plaid — same security your bank uses.`,
  },
  cancel: {
    headline: "The subscriptions you keep meaning to cancel.",
    subheadline:
      `Find every recurring charge in ${LANDING.timeToValue.display}. Then we help you cancel the ones you don't use.`,
  },
  tracker: {
    headline: "A subscription tracker that finds the ones you forgot.",
    subheadline:
      `Connects to your bank in ${LANDING.timeToValue.display}. Read-only via Plaid. Most people find $${LANDING.forgotten.monthlyTotalUsd}/mo they didn't know about.`,
  },
  find: {
    headline: "Find every subscription charging you today.",
    subheadline:
      `Most people miss ${LANDING.forgotten.countMin}–${LANDING.forgotten.countMax} of them. Frugavo surfaces all of them in ${LANDING.timeToValue.display}.`,
  },
  competitor: {
    headline:
      "Like Rocket Money, calmer. Like Truebill, free during early access.",
    subheadline:
      `Find every recurring charge in ${LANDING.timeToValue.display}. No upsells, no auto-cancel surprises.`,
  },
};

/**
 * Headline-only A/B variants. Composed orthogonally with HERO_VARIANTS
 * via the `?h=` URL param.
 *
 *   control — the current hedged headline
 *   a       — drops the hedge word "probably"
 *   b       — outcome-focused, leads with the action
 *
 * If `?h=` is absent the variant's own default headline is used.
 * If `?h=control` is passed alongside `?v=cancel`, the headline from
 * HEADLINE_AB.control overrides the cancel variant's headline.
 *
 * Wired for testing only — no auto-deploy of a winner.
 */
export type HeadlineKey = "control" | "a" | "b";

export const HEADLINE_AB: Record<HeadlineKey, string> = {
  control:
    "You're probably paying for subscriptions you've forgotten about.",
  a: "You're paying for subscriptions you've forgotten about.",
  b: `Find every recurring charge on your statement in ${LANDING.timeToValue.display}.`,
};

/**
 * Resolve the active variant from a URL search-params bag. Safe to
 * call server-side (Next.js `searchParams`) or client-side (with
 * `Object.fromEntries(new URLSearchParams(...))`). Unknown values
 * always fall back to `default` / undefined; never throws.
 */
export function resolveVariant(
  search: Record<string, string | string[] | undefined>
): { variant: VariantKey; headlineOverride: string | undefined } {
  const vRaw = typeof search.v === "string" ? search.v.toLowerCase() : null;
  const hRaw = typeof search.h === "string" ? search.h.toLowerCase() : null;

  const variant: VariantKey = (
    vRaw && vRaw in HERO_VARIANTS ? vRaw : "default"
  ) as VariantKey;

  const headlineOverride =
    hRaw && hRaw in HEADLINE_AB ? HEADLINE_AB[hRaw as HeadlineKey] : undefined;

  return { variant, headlineOverride };
}
