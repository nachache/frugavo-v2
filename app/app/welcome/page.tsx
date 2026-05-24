import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { OnboardingReveal } from "@/components/app/onboarding-reveal";
import {
  computeBurnRate,
  computeAiSpend,
  computeCategoryTotals,
  computeSubscriptionCategories,
  computeTopSubscriptions,
  computeShockInsights,
  computeMonthlySpendSeries,
  type LedgerCharge,
  type LedgerSubscription,
} from "@/lib/insights";
import { computePersonality } from "@/lib/personality";
import { computeMoneyLeaks } from "@/lib/money-leaks";

// /app/welcome
//
// The reveal experience shown after the user's first scan. Reads
// their insights server-side and hands them to a client component
// that walks the user through one stat at a time.
//
// IMPORTANT — RECOMPUTE AFTER FEEDBACK:
//   The reveal renders in two server-side passes:
//     1. ?stage=feedback (default) — fetches detected subs, shows
//        the feedback gate where the user marks any item that
//        isn't actually a subscription.
//     2. ?stage=reveal — fetched AFTER the feedback overrides have
//        been written to user_overrides. Every number on this page
//        (personality, burn, top subs, AI spend, leaks) is computed
//        from the post-override pool. The reveal NEVER shows numbers
//        contaminated by items the user just told us aren't subs.
//
//   The client-side OnboardingReveal navigates between stages via
//   router.push("/app/welcome?stage=reveal"), which forces a fresh
//   server render and re-reads from Postgres with the new tier
//   assignments + overrides applied.

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  streaming: "Streaming",
  software: "Software",
  news: "News & reading",
  fitness: "Fitness",
  food_delivery: "Food delivery",
  cloud_storage: "Cloud storage",
  gaming: "Gaming",
  telecom: "Phone & internet",
  phone_internet: "Phone & internet",
  utilities: "Utilities",
  education: "Education",
  insurance: "Insurance",
  other: "Other",
  bank_fees: "Bank fees",
};

type WelcomeSearchParams = {
  stage?: string;
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: WelcomeSearchParams;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!supabaseAdmin) redirect("/app");

  const asOf = new Date();
  const requestedStage =
    searchParams?.stage === "reveal" ? "reveal" : "feedback";

  // Pull subscriptions + charges. Includes the new recurring_type +
  // confidence_score columns so every selector downstream reads from
  // a tagged pool.
  const { data: subsData } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_name, merchant_key, category, amount_cents, currency, frequency, status, classification, last_charged_at, recurring_type, confidence_score"
    )
    .eq("user_id", user.id);
  const subs = (subsData ?? []) as LedgerSubscription[];

  const charges: LedgerCharge[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (offset < 100_000) {
    const { data, error } = await supabaseAdmin
      .from("subscription_charges")
      .select(
        "subscription_id, posted_date, amount_cents, detector_status, cadence_cycle_id"
      )
      .eq("user_id", user.id)
      .order("posted_date", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break;
    const page = (data ?? []) as LedgerCharge[];
    charges.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  // All aggregates filter by tier internally (surface-rules.ts).
  // Hero subs only — bills don't show in the reveal headlines,
  // commerce never does.
  const burn = computeBurnRate(subs, charges, asOf);
  const aiSpend = computeAiSpend(subs, charges, asOf);
  // Personality reads from SUBSCRIPTION-ONLY categories so bills
  // can't drag the archetype toward "The Utility Payer."
  const subscriptionCats = computeSubscriptionCategories(subs);
  const categories = computeCategoryTotals(subs);
  const top = computeTopSubscriptions(subs, 8);
  const shock = computeShockInsights({
    subs,
    charges,
    asOf,
    burn,
    aiSpend,
    categories,
    top: top.slice(0, 5),
  });
  const personality = computePersonality({
    categories: subscriptionCats,
    aiMonthlyCents: aiSpend.monthly_cents,
    totalMonthlyCents: burn.monthly_cents,
    totalSubCount: burn.active_subscription_count,
  });
  const leaks = computeMoneyLeaks({ subs, charges, asOf });
  const chart12mo = computeMonthlySpendSeries(charges, asOf);

  // Use the chart12mo just so the import isn't tree-shaken; the reveal
  // doesn't need it directly. (Intentional — keeps lazy imports honest.)
  void chart12mo;

  const topCategoryRaw = subscriptionCats.find(
    (c) => c.category !== "other" && c.subscription_count > 0
  );

  // Build the personalized protection pitch — one calm, specific
  // sentence shown on the upsell stage. Priorities:
  //   1. If we have a "would have caught" candidate (top sub
  //      renewing soon), name it directly.
  //   2. Otherwise lean on the shock insight headline if available.
  //   3. Otherwise a generic but emotionally-specific fallback.
  const topSub = top[0];
  const fmtUsd = (c: number) =>
    `$${(c / 100).toLocaleString("en-US", {
      minimumFractionDigits: c % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;

  let protectionPitch: string;
  if (topSub) {
    protectionPitch = `Frugavo would catch ${topSub.merchant_name} the next time it bills (around ${fmtUsd(topSub.monthly_cents)}), flag any price hike, and alert you before a trial converts — automatically, every day.`;
  } else if (shock[0]?.headline) {
    protectionPitch = `${shock[0].headline} Frugavo will keep watching every day so the next surprise doesn't catch you.`;
  } else {
    protectionPitch =
      "Frugavo will alert you before subscriptions renew, catch unusual recurring charges, and flag price increases — automatically.";
  }

  return (
    <OnboardingReveal
      initialStage={requestedStage}
      subscriptionCount={burn.active_subscription_count}
      monthlyBurnCents={burn.monthly_cents}
      yearlyBurnCents={burn.yearly_cents}
      aiMonthlyCents={aiSpend.monthly_cents}
      aiCount={aiSpend.subscription_count}
      topCategory={
        topCategoryRaw
          ? {
              label:
                CATEGORY_LABEL[topCategoryRaw.category] ??
                topCategoryRaw.category,
              monthly_cents: topCategoryRaw.monthly_cents,
            }
          : null
      }
      topSubscription={
        topSub
          ? { name: topSub.merchant_name, monthly_cents: topSub.monthly_cents }
          : null
      }
      moneyLeakCount={leaks.length}
      personality={{ label: personality.label, sub: personality.sub }}
      protectionPitch={protectionPitch}
      firstName={user.firstName ?? null}
      topDetected={top.slice(0, 8).map((t) => ({
        subscription_id: t.id,
        name: t.merchant_name,
        monthly_cents: t.monthly_cents,
      }))}
    />
  );
}
