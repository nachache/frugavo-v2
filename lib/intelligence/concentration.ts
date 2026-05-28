import type { CategoryTotal } from "../insights";

// Concentration interpretation — turns the category breakdown into
// a single human-meaningful insight line, not a generic "5 categories".
//
// The math: Herfindahl-Hirschman Index (HHI) over category shares of
// recurring spend. HHI close to 1 = one category dominates. HHI close
// to 1/N = perfectly diversified across N buckets.
//
// Interpretation buckets:
//   share ≥ 0.55 of one category  → "{Category} dominates your recurring spend"
//   HHI ≥ 0.45                    → "Concentration higher than typical"
//   HHI ≤ 0.20                    → "Your spending is diversified"
//   essentials share ≥ 0.65       → "Mostly essentials"
//   else                          → "Balanced across {N} categories"
//
// Returned tone is calm, observational, never alarming. The insight
// is what the user CAN'T see by glancing at the donut.

export type ConcentrationInsight = {
  headline: string;
  // Sub-line — one short fact that anchors the headline in data.
  detail: string;
  // 'positive' = healthy diversification / sensible essentials lean
  // 'neutral'  = informational
  // 'attention' = concentration risk or imbalance worth noticing
  tone: "positive" | "neutral" | "attention";
};

const ESSENTIAL_CATEGORIES = new Set([
  "utilities",
  "phone_internet",
  "telecom",
  "insurance",
  "rent",
]);

const PRETTY: Record<string, string> = {
  software: "Software",
  streaming: "Streaming",
  fitness: "Fitness",
  news: "News & reading",
  food_delivery: "Food delivery",
  cloud_storage: "Cloud storage",
  gaming: "Gaming",
  telecom: "Phone & internet",
  phone_internet: "Phone & internet",
  utilities: "Utilities",
  education: "Education",
  insurance: "Insurance",
  health: "Healthcare",
  rent: "Rent",
  other: "Other",
  bank_fees: "Bank fees",
};

function pretty(name: string): string {
  return PRETTY[name] ?? name.replace(/_/g, " ");
}

export function computeConcentrationInsight(
  categories: CategoryTotal[]
): ConcentrationInsight {
  const real = categories.filter(
    (c) => c.monthly_cents > 0 && c.category !== "other"
  );

  if (real.length === 0) {
    return {
      headline: "Nothing recurring yet",
      detail: "Frugavo will analyze patterns as charges accrue.",
      tone: "neutral",
    };
  }

  const total = real.reduce((acc, c) => acc + c.monthly_cents, 0);
  if (total === 0) {
    return {
      headline: "Nothing recurring yet",
      detail: "Frugavo will analyze patterns as charges accrue.",
      tone: "neutral",
    };
  }

  // Sort categories by share, descending.
  const ranked = [...real]
    .map((c) => ({
      ...c,
      share: c.monthly_cents / total,
    }))
    .sort((a, b) => b.share - a.share);

  const top = ranked[0];

  // Herfindahl-Hirschman Index — sum of squared shares.
  const hhi = ranked.reduce((acc, c) => acc + c.share * c.share, 0);

  // Essentials share.
  const essentialsShare = ranked
    .filter((c) => ESSENTIAL_CATEGORIES.has(c.category))
    .reduce((acc, c) => acc + c.share, 0);

  // 1. Single category strongly dominates.
  if (top.share >= 0.55) {
    return {
      headline: `${pretty(top.category)} dominates your recurring spend`,
      detail: `${Math.round(top.share * 100)}% of your monthly recurring goes to ${pretty(top.category).toLowerCase()}.`,
      tone: top.category === "other" ? "attention" : "neutral",
    };
  }

  // 2. Essentials lean — calm, positive framing.
  if (essentialsShare >= 0.65) {
    return {
      headline: "Mostly essentials",
      detail: `${Math.round(essentialsShare * 100)}% of your recurring spend is utilities, telecom, and insurance.`,
      tone: "positive",
    };
  }

  // 3. Concentrated portfolio — high HHI but no single dominator.
  if (hhi >= 0.45) {
    return {
      headline: "Concentration higher than typical",
      detail: `${pretty(top.category)} and ${pretty(ranked[1]?.category ?? "other")} carry most of the load — ${Math.round((top.share + (ranked[1]?.share ?? 0)) * 100)}% combined.`,
      tone: "attention",
    };
  }

  // 4. Diversified — low HHI.
  if (hhi <= 0.2 && ranked.length >= 5) {
    return {
      headline: "Your spending is diversified",
      detail: `Spread across ${ranked.length} categories with no single one above ${Math.round(top.share * 100)}%.`,
      tone: "positive",
    };
  }

  // 5. Default — balanced.
  return {
    headline: `Balanced across ${ranked.length} categor${ranked.length === 1 ? "y" : "ies"}`,
    detail: `${pretty(top.category)} is your largest at ${Math.round(top.share * 100)}%.`,
    tone: "neutral",
  };
}
