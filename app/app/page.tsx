import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { runScanForUser } from "@/lib/scan";
import { nextRecommendation } from "@/lib/recommendations";
import {
  SubscriptionList,
  type Subscription,
} from "@/components/app/subscription-list";
import { RecommendationBanner } from "@/components/app/recommendation-banner";

// /app — the authenticated dashboard root.
//
// Routing logic:
//   1. No bank connected → /app/connect.
//   2. Bank connected, no scan yet → run scan inline, then render list.
//   3. Bank connected, scan complete → render list with cached data and
//      let the user trigger a re-scan from the list UI.

export default async function AppHome() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  if (!supabaseAdmin) {
    return (
      <section className="container-page py-16 md:py-24 max-w-[720px]">
        <p className="text-[15px] text-danger">
          Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and
          SUPABASE_SERVICE_ROLE_KEY in your Netlify environment variables.
        </p>
      </section>
    );
  }

  // Ensure the app_users mirror row exists.
  await supabaseAdmin.from("app_users").upsert(
    {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress ?? "",
    },
    { onConflict: "id" }
  );

  // Step 1 — does the user have any connected bank?
  const { data: items } = await supabaseAdmin
    .from("plaid_items")
    .select("id, status, last_synced_at")
    .eq("user_id", user.id);

  if (!items || items.length === 0) {
    return (
      <section className="container-page py-16 md:py-24 max-w-[720px]">
        <span className="text-[13px] font-medium text-brand">
          Welcome to Frugavo
        </span>
        <h1 className="mt-2 font-display text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
          Let&apos;s connect your bank.
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-body">
          Frugavo connects to your bank through Plaid — the same infrastructure
          your bank app uses. We use a read-only scope: we can see your
          recurring charges, we cannot move money or send email on your behalf.
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
          Bank-grade encryption. Your credentials never touch our servers. You
          can disconnect any time and your data is deleted within 30 days.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app/connect"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-hover transition"
          >
            Connect my bank
          </Link>
          <Link
            href="/learn"
            className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium text-ink hover:bg-ink/[0.04] transition"
          >
            Read about how it works
          </Link>
        </div>
      </section>
    );
  }

  // Step 2 — are there existing subscriptions for this user?
  let subs = await fetchSubscriptions(user.id);

  // First scan: if there are connected items but no rows in `subscriptions`
  // yet, run a synchronous scan now so the user sees data on first visit.
  // Subsequent visits use the cached rows; the user can hit "Re-scan" in
  // the UI to refresh.
  const noScanYet = items.every((i) => !i.last_synced_at);
  if (subs.length === 0 && noScanYet) {
    await runScanForUser(user.id);
    subs = await fetchSubscriptions(user.id);
  }

  const charges = await fetchCharges(user.id);
  const recommendation = await nextRecommendation(user.id);

  return (
    <section className="container-page py-12 md:py-16 max-w-[1200px]">
      <span className="text-[13px] font-medium text-brand">Dashboard</span>
      <h1 className="mt-2 font-display text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Your subscriptions
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-body">
        Every recurring charge Plaid detected on your connected accounts.
        Re-scan to pull the latest.
      </p>

      <div className="mt-10">
        <RecommendationBanner rec={recommendation} />
        <SubscriptionList initial={subs} charges={charges} />
      </div>
    </section>
  );
}

async function fetchSubscriptions(userId: string): Promise<Subscription[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_name, normalized_name, category, amount_cents, currency, frequency, last_charged_at, next_expected_charge_at, regret_score, status, user_decision"
    )
    .eq("user_id", userId)
    .order("status", { ascending: true })
    .order("amount_cents", { ascending: false });

  return (data ?? []) as Subscription[];
}

// Trailing-12-month window of charges. Drives the hero area chart. We
// bound by date to keep the payload small even for users with years of
// history in production.
async function fetchCharges(
  userId: string
): Promise<{ amount_cents: number; charged_at: string }[]> {
  if (!supabaseAdmin) return [];
  const since = new Date();
  since.setMonth(since.getMonth() - 13);
  const { data } = await supabaseAdmin
    .from("subscription_charges")
    .select("amount_cents, charged_at")
    .eq("user_id", userId)
    .gte("charged_at", since.toISOString().slice(0, 10))
    .order("charged_at", { ascending: true });
  return (data ?? []) as { amount_cents: number; charged_at: string }[];
}
