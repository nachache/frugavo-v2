import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { OnboardingReveal } from "@/components/app/onboarding-reveal";
import {
  computeBurnRate,
  computeAiSpend,
  computeCategoryTotals,
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
// Re-visits: anyone can hit /app/welcome to replay their reveal.
// The dashboard never auto-redirects here after the first time —
// /app sets the redirect on first scan via the `?welcome=1`
// fingerprint check.

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

export default async function WelcomePage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!supabaseAdmin) redirect("/app");

  const asOf = new Date();

  // Pull subscriptions + charges.
  const { data: subsData } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_name, merchant_key, category, amount_cents, currency, frequency, status, classification, last_charged_at"
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

  const burn = computeBurnRate(subs, charges, asOf);
  const aiSpend = computeAiSpend(subs, charges, asOf);
  const categories = computeCategoryTotals(subs);
  const top = computeTopSubscriptions(subs, 5);
  const shock = computeShockInsights({
    subs,
    charges,
    asOf,
    burn,
    aiSpend,
    categories,
    top,
  });
  const personality = computePersonality({
    categories,
    aiMonthlyCents: aiSpend.monthly_cents,
    totalMonthlyCents: burn.monthly_cents,
    totalSubCount: burn.active_subscription_count,
  });
  const leaks = computeMoneyLeaks({ subs, charges, asOf });
  const chart12mo = computeMonthlySpendSeries(charges, asOf);

  // Use the chart12mo just so the import isn't tree-shaken; the reveal
  // doesn't need it directly. (Intentional — keeps lazy imports honest.)
  void chart12mo;

  const topCategoryRaw = categories.find(
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
