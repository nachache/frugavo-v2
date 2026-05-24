// Subscription personality classifier.
//
// Pure deterministic function: same category-spend mix → same label.
// No AI calls. The output is a single human-friendly identity that the
// dashboard can show as "you're a {Type}".
//
// Each personality has:
//   - a trigger condition over category percentages and counts
//   - a copy line for the headline
//   - a sub-copy describing what made the engine pick it
//
// Conditions are checked in priority order. The first match wins.
// The fallback ("Curious Spender") covers everyone else.

import type { CategoryTotal } from "./insights";

export type Personality = {
  id: string;
  label: string;
  headline: string;
  sub: string;
};

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return part / whole;
}

export function computePersonality(args: {
  categories: CategoryTotal[];
  aiMonthlyCents: number;
  totalMonthlyCents: number;
  totalSubCount: number;
}): Personality {
  const { categories, aiMonthlyCents, totalMonthlyCents, totalSubCount } = args;

  // ───────────────────────────────────────────────────────────
  // Sparse-data guard. Per Constraint #6: "personality should
  // activate only from validated subscriptions, meaningful
  // recurring patterns, high-confidence signals. Otherwise it
  // feels fabricated."
  //
  // If the user has barely any confirmed subscriptions, we don't
  // pretend to know their personality. We return a calm, honest
  // "we're still learning you" label that doesn't invent an
  // identity from noise.
  // ───────────────────────────────────────────────────────────
  if (totalSubCount === 0 || totalMonthlyCents === 0) {
    return {
      id: "still_watching",
      label: "Quietly Watching",
      headline: "Quietly Watching",
      sub: "No confirmed subscriptions yet — Frugavo will keep an eye on your charges.",
    };
  }
  if (totalSubCount < 3) {
    return {
      id: "lean_and_intentional",
      label: "Lean & Intentional",
      headline: "Lean & Intentional",
      sub: `Only ${totalSubCount} confirmed ${totalSubCount === 1 ? "subscription" : "subscriptions"} on your account. Hard to surprise you.`,
    };
  }

  const aiShare = pct(aiMonthlyCents, totalMonthlyCents);

  const findCat = (name: string) =>
    categories.find((c) => c.category === name);
  const softwareCat = findCat("software");
  const streamingCat = findCat("streaming");
  const fitnessCat = findCat("fitness");
  const newsCat = findCat("news");

  // 1. Automation Addict — AI dominates the budget.
  if (aiShare >= 0.3 && aiMonthlyCents >= 5000) {
    return {
      id: "automation_addict",
      label: "The Automation Addict",
      headline: "The Automation Addict",
      sub: `${Math.round(aiShare * 100)}% of your subscription budget goes to AI tools.`,
    };
  }

  // 2. SaaS Operator — heavy software spend, many software subs.
  if (
    softwareCat &&
    softwareCat.subscription_count >= 5 &&
    pct(softwareCat.monthly_cents, totalMonthlyCents) >= 0.4
  ) {
    return {
      id: "saas_operator",
      label: "The SaaS Operator",
      headline: "The SaaS Operator",
      sub: `${softwareCat.subscription_count} software subscriptions running your stack.`,
    };
  }

  // 3. Productivity Maximalist — software-dominant but fewer subs.
  if (
    softwareCat &&
    pct(softwareCat.monthly_cents, totalMonthlyCents) >= 0.3 &&
    softwareCat.subscription_count >= 2
  ) {
    return {
      id: "productivity_maximalist",
      label: "The Productivity Maximalist",
      headline: "The Productivity Maximalist",
      sub: `Most of your spend powers the tools you work in.`,
    };
  }

  // 4. Streaming Collector — streaming-dominant or many streaming subs.
  if (
    streamingCat &&
    (streamingCat.subscription_count >= 4 ||
      pct(streamingCat.monthly_cents, totalMonthlyCents) >= 0.35)
  ) {
    return {
      id: "streaming_collector",
      label: "The Streaming Collector",
      headline: "The Streaming Collector",
      sub: `${streamingCat.subscription_count} streaming services on rotation.`,
    };
  }

  // 5. Wellness Devotee — fitness category meaningful share.
  if (
    fitnessCat &&
    pct(fitnessCat.monthly_cents, totalMonthlyCents) >= 0.2 &&
    fitnessCat.subscription_count >= 1
  ) {
    return {
      id: "wellness_devotee",
      label: "The Wellness Devotee",
      headline: "The Wellness Devotee",
      sub: `Showing up monthly for your body — every month.`,
    };
  }

  // 6. Knowledge Seeker — news & reading prominent.
  if (
    newsCat &&
    (newsCat.subscription_count >= 3 ||
      pct(newsCat.monthly_cents, totalMonthlyCents) >= 0.2)
  ) {
    return {
      id: "knowledge_seeker",
      label: "The Knowledge Seeker",
      headline: "The Knowledge Seeker",
      sub: `Reading more publications than most people open in a week.`,
    };
  }

  // 7. Minimalist — under 3 active subs total.
  if (totalSubCount > 0 && totalSubCount <= 3) {
    return {
      id: "minimalist",
      label: "The Minimalist",
      headline: "The Minimalist",
      sub: `${totalSubCount} active ${totalSubCount === 1 ? "subscription" : "subscriptions"}. Intentional.`,
    };
  }

  // 8. Fallback — generic curious-spender label.
  return {
    id: "curious_spender",
    label: "The Curious Spender",
    headline: "The Curious Spender",
    sub: `A mix of categories — no single one dominates.`,
  };
}
