// Dollar-to-things translator.
//
// Translates a dollar amount into a concrete, vivid thing the user
// can picture. "$612/yr saved" is abstract. "That's a flight to
// Lisbon" lands in the body.
//
// Bands are deliberately aspirational + universal — most users can
// picture a tank of gas, a dinner out, a weekend trip. We avoid
// hyper-specific items that only resonate with certain demographics
// (e.g. "a PS5" reads better than "a Mary Quant lipstick").
//
// Used by:
//   - CancelCelebration (the "+$X/yr. That's a Y." line after cancel)
//   - Scan reveal (savings total translated into something vivid)
//   - Future: insight cards, share images, alert emails

export type DollarThing = {
  // The thing itself, in lower case, no period. Caller adds "That's "
  // prefix or other framing.
  label: string;
  // A short 1-word category for analytics / icon picking later.
  category:
    | "coffee"
    | "food"
    | "travel"
    | "gear"
    | "experience"
    | "milestone";
};

// Bands are evaluated in ascending order. First match wins.
// Each band lists 2-3 alternatives so repeated cancels feel less
// repetitive — we pick one deterministically based on the dollar
// amount itself (no randomness, replay-safe).
const BANDS: { max: number; options: DollarThing[] }[] = [
  {
    max: 25,
    options: [
      { label: "a fancy coffee every week", category: "coffee" },
      { label: "your morning latte habit, indefinitely", category: "coffee" },
    ],
  },
  {
    max: 60,
    options: [
      { label: "a Sunday brunch out", category: "food" },
      { label: "two takeout dinners", category: "food" },
      { label: "a full tank of gas", category: "gear" },
    ],
  },
  {
    max: 120,
    options: [
      { label: "a nice dinner for two", category: "food" },
      { label: "a month of groceries for one", category: "food" },
      { label: "two tanks of gas", category: "gear" },
    ],
  },
  {
    max: 250,
    options: [
      { label: "a really good steak dinner for two", category: "food" },
      { label: "a new pair of running shoes", category: "gear" },
      { label: "a month of groceries for two", category: "food" },
    ],
  },
  {
    max: 500,
    options: [
      { label: "a weekend escape close to home", category: "travel" },
      { label: "a year of Spotify, Netflix, and Disney+ combined", category: "experience" },
      { label: "two months of groceries", category: "food" },
    ],
  },
  {
    max: 1_000,
    options: [
      { label: "a flight to Lisbon", category: "travel" },
      { label: "a flight to Mexico City", category: "travel" },
      { label: "a new iPhone, with cash left over", category: "gear" },
    ],
  },
  {
    max: 2_500,
    options: [
      { label: "a long weekend in Mexico City", category: "travel" },
      { label: "a brand new MacBook Air", category: "gear" },
      { label: "your rent for a month", category: "milestone" },
    ],
  },
  {
    max: 5_000,
    options: [
      { label: "a two-week vacation", category: "travel" },
      { label: "a PS5 with three years of games", category: "gear" },
      { label: "a beautiful e-bike", category: "gear" },
    ],
  },
  {
    max: 10_000,
    options: [
      { label: "a month off work", category: "milestone" },
      { label: "a used car in decent shape", category: "milestone" },
      { label: "a year of therapy", category: "experience" },
    ],
  },
  {
    max: 25_000,
    options: [
      { label: "a year of retirement, eventually", category: "milestone" },
      { label: "a serious emergency fund", category: "milestone" },
      { label: "a year abroad on a tight budget", category: "travel" },
    ],
  },
  {
    max: Number.POSITIVE_INFINITY,
    options: [
      { label: "a down payment on a small place", category: "milestone" },
      { label: "two years of rent, somewhere quiet", category: "milestone" },
      { label: "real, life-changing money", category: "milestone" },
    ],
  },
];

/**
 * Translate a dollar amount (USD, whole or fractional dollars) into a
 * concrete thing string. Deterministic: same input → same output.
 *
 * Returns just the noun phrase, e.g. "a flight to Lisbon".
 * Caller composes the framing: "That's a flight to Lisbon."
 */
export function dollarsToThing(usd: number): DollarThing {
  const dollars = Math.max(0, Math.abs(usd));
  for (const band of BANDS) {
    if (dollars <= band.max) {
      // Deterministic pick within the band — hash the cents to an
      // index. Same amount always yields the same option, so a re-
      // render doesn't shuffle.
      const cents = Math.round(dollars * 100);
      const idx = cents % band.options.length;
      return band.options[idx];
    }
  }
  // Defensive fallback (should be unreachable given infinity max above).
  return BANDS[BANDS.length - 1].options[0];
}

/**
 * Convenience composer for the most common UI use case.
 * Example: "That's a flight to Lisbon."
 */
export function dollarsToThingSentence(usd: number): string {
  const t = dollarsToThing(usd);
  // Add period if the label doesn't already end in punctuation.
  const punct = /[.!?]$/.test(t.label) ? "" : ".";
  return `That's ${t.label}${punct}`;
}
