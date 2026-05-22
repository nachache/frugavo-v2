import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/subscriptions/:id/detail
//
// Full per-subscription detail page payload. One call returns:
//   - subscription header (name, category, status, frequency, monthly)
//   - full billing history with accepted/outlier labels
//   - stats block: yearly_spend, average_monthly, months_active,
//                  last_charged, highest_charge, lowest_charge,
//                  total_charged, average_amount, on_time_streak
//   - price-change timeline: every distinct accepted amount in cycle
//                            order, so the UI can show "$14.99 →
//                            $17.99 in cycle 7"
//
// Every field is derived from real ledger rows. No estimates.

export const runtime = "nodejs";
export const maxDuration = 5;

type SubRow = {
  id: string;
  user_id: string;
  merchant_name: string;
  category: string;
  amount_cents: number;
  currency: string;
  frequency: string;
  status: string;
  classification: string | null;
  last_charged_at: string | null;
  next_expected_charge_at: string | null;
};

type ChargeRow = {
  id: string;
  posted_date: string;
  amount_cents: number;
  currency: string;
  detector_status: "accepted" | "outlier" | "ignored";
  matched_by: string;
  cadence_cycle_id: number | null;
  raw_descriptor: string | null;
  scanner_version: string;
};

function monthsBetween(a: string, b: string): number {
  const da = new Date(a + (a.length === 10 ? "T00:00:00Z" : ""));
  const db = new Date(b + (b.length === 10 ? "T00:00:00Z" : ""));
  return (
    (db.getUTCFullYear() - da.getUTCFullYear()) * 12 +
    (db.getUTCMonth() - da.getUTCMonth())
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const subscriptionId = params.id;
  if (!subscriptionId || !/^[0-9a-f-]{36}$/i.test(subscriptionId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  // ---- Subscription header ----
  const { data: sub, error: subErr } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, user_id, merchant_name, category, amount_cents, currency, frequency, status, classification, last_charged_at, next_expected_charge_at"
    )
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (subErr) {
    return NextResponse.json(
      { error: "subscription_lookup_failed", details: subErr.message },
      { status: 500 }
    );
  }
  if (!sub) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const subscription = sub as SubRow;

  // ---- Full charge history (asc by date so cycle-walking is easy) ----
  const { data: chargesData, error: chargesErr } = await supabaseAdmin
    .from("subscription_charges")
    .select(
      "id, posted_date, amount_cents, currency, detector_status, matched_by, cadence_cycle_id, raw_descriptor, scanner_version"
    )
    .eq("user_id", user.id)
    .eq("subscription_id", subscriptionId)
    .order("posted_date", { ascending: true });

  if (chargesErr) {
    return NextResponse.json(
      { error: "charges_read_failed", details: chargesErr.message },
      { status: 500 }
    );
  }
  const charges = (chargesData ?? []) as ChargeRow[];

  // ---- Stats over ACCEPTED charges only (real cadence spend) ----
  const accepted = charges.filter((c) => c.detector_status === "accepted");
  const outliers = charges.filter((c) => c.detector_status === "outlier");
  const acceptedAmounts = accepted.map((c) => c.amount_cents);

  const totalChargedCents = acceptedAmounts.reduce((a, b) => a + b, 0);
  const averageAmountCents = acceptedAmounts.length
    ? Math.round(totalChargedCents / acceptedAmounts.length)
    : 0;
  const highestCharge = accepted.reduce<ChargeRow | null>(
    (best, c) =>
      best === null || c.amount_cents > best.amount_cents ? c : best,
    null
  );
  const lowestCharge = accepted.reduce<ChargeRow | null>(
    (best, c) =>
      best === null || c.amount_cents < best.amount_cents ? c : best,
    null
  );

  const firstChargeDate = accepted[0]?.posted_date ?? null;
  const lastChargeDate = accepted[accepted.length - 1]?.posted_date ?? null;

  // Months active = span of the accepted history, minimum 1.
  let monthsActive = 0;
  if (firstChargeDate && lastChargeDate) {
    monthsActive = Math.max(1, monthsBetween(firstChargeDate, lastChargeDate) + 1);
  }

  // Yearly spend: prefer the trailing-12-month sum from real data.
  // Falls back to total when the user has less than a year of history.
  let yearlySpendCents = 0;
  if (lastChargeDate) {
    const oneYearAgo = new Date(lastChargeDate);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoff = oneYearAgo.toISOString().slice(0, 10);
    yearlySpendCents = accepted
      .filter((c) => c.posted_date >= cutoff)
      .reduce((a, c) => a + c.amount_cents, 0);
  }

  // Average monthly: total / months active. Empty when no history.
  const averageMonthlyCents =
    monthsActive > 0 ? Math.round(totalChargedCents / monthsActive) : 0;

  // ---- Price-change timeline ----
  // Walk accepted charges in cycle order. Each time the amount differs
  // from the previous accepted cycle's amount, push a change event.
  type PriceChange = {
    cycle_from: number | null;
    cycle_to: number | null;
    date_from: string;
    date_to: string;
    amount_from_cents: number;
    amount_to_cents: number;
    delta_cents: number;
    delta_pct: number;
  };
  const priceChanges: PriceChange[] = [];
  const cycleSorted = [...accepted].sort(
    (a, b) => (a.cadence_cycle_id ?? 0) - (b.cadence_cycle_id ?? 0)
  );
  for (let i = 1; i < cycleSorted.length; i++) {
    const prev = cycleSorted[i - 1];
    const curr = cycleSorted[i];
    if (prev.amount_cents !== curr.amount_cents) {
      const delta = curr.amount_cents - prev.amount_cents;
      priceChanges.push({
        cycle_from: prev.cadence_cycle_id,
        cycle_to: curr.cadence_cycle_id,
        date_from: prev.posted_date,
        date_to: curr.posted_date,
        amount_from_cents: prev.amount_cents,
        amount_to_cents: curr.amount_cents,
        delta_cents: delta,
        delta_pct:
          prev.amount_cents > 0
            ? Math.round((delta / prev.amount_cents) * 1000) / 10
            : 0,
      });
    }
  }

  // ---- Response ----
  return NextResponse.json(
    {
      subscription: {
        id: subscription.id,
        merchant_name: subscription.merchant_name,
        category: subscription.category,
        amount_cents: subscription.amount_cents,
        currency: subscription.currency,
        frequency: subscription.frequency,
        status: subscription.status,
        classification: subscription.classification,
        last_charged_at: subscription.last_charged_at,
        next_expected_charge_at: subscription.next_expected_charge_at,
      },
      stats: {
        yearly_spend_cents: yearlySpendCents,
        average_monthly_cents: averageMonthlyCents,
        total_charged_cents: totalChargedCents,
        average_amount_cents: averageAmountCents,
        months_active: monthsActive,
        accepted_count: accepted.length,
        outlier_count: outliers.length,
        first_charge_date: firstChargeDate,
        last_charge_date: lastChargeDate,
        highest_charge: highestCharge
          ? {
              amount_cents: highestCharge.amount_cents,
              date: highestCharge.posted_date,
              cycle: highestCharge.cadence_cycle_id,
            }
          : null,
        lowest_charge: lowestCharge
          ? {
              amount_cents: lowestCharge.amount_cents,
              date: lowestCharge.posted_date,
              cycle: lowestCharge.cadence_cycle_id,
            }
          : null,
      },
      price_changes: priceChanges,
      charges: [...charges].reverse(), // newest-first for the timeline UI
    },
    { headers: { "Cache-Control": "private, no-store, must-revalidate" } }
  );
}
