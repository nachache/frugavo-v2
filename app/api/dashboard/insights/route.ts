import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  computeBurnRate,
  computeMonthlySpendSeries,
  computeCategoryTotals,
  computeAiSpend,
  computeTopSubscriptions,
  computeShockInsights,
  type LedgerCharge,
  type LedgerSubscription,
} from "@/lib/insights";
import { computePersonality } from "@/lib/personality";
import { computeMoneyLeaks } from "@/lib/money-leaks";

// GET /api/dashboard/insights
//
// One round-trip for the new dashboard. Everything the
// "emotionally compelling financial insight" experience needs:
//   - burn (monthly + yearly + ledger-actual yearly)
//   - 12-month spend chart series
//   - category totals
//   - AI spend bucket
//   - top subscriptions
//   - shock insight cards
//   - subscription personality
//   - money-leak detections
//
// All values derived from real ledger rows. Pure functions in
// lib/insights.ts, lib/personality.ts, lib/money-leaks.ts.
// Deterministic — same DB state + same asOf → identical response.
//
// Auth: user scopes only. Returns empty payload structure when the
// user has no subscriptions yet (rather than 404 — the dashboard
// can render an empty-state cleanly).

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const asOf = new Date();

  // ---- Pull subscriptions ----
  const { data: subsData, error: subsErr } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_name, merchant_key, category, amount_cents, currency, frequency, status, classification, last_charged_at"
    )
    .eq("user_id", user.id);

  if (subsErr) {
    return NextResponse.json(
      { error: "subs_read_failed", details: subsErr.message },
      { status: 500 }
    );
  }
  const subs: LedgerSubscription[] = (subsData ?? []) as LedgerSubscription[];

  // ---- Pull charges (paginated; ledger can be large) ----
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

  // ---- Compute every insight ----
  const burn = computeBurnRate(subs, charges, asOf);
  const chart12mo = computeMonthlySpendSeries(charges, asOf);
  const categories = computeCategoryTotals(subs);
  const aiSpend = computeAiSpend(subs, charges, asOf);
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

  return NextResponse.json(
    {
      as_of: asOf.toISOString(),
      burn,
      chart_12mo: chart12mo,
      categories,
      ai_spend: aiSpend,
      top_subscriptions: top,
      shock_insights: shock,
      personality,
      money_leaks: leaks,
      meta: {
        subscriptions_total: subs.length,
        charges_total: charges.length,
      },
    },
    { headers: { "Cache-Control": "private, no-store, must-revalidate" } }
  );
}
