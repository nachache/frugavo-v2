import { redirect, notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { SubscriptionDetailView } from "@/components/app/subscription-detail-view";
import { userHasAccess } from "@/lib/billing/gates";

// /app/subscriptions/[id]
//
// Subscription detail page — the "this is my real billing history"
// drill-down from the dashboard list. Pure server component: pulls
// the subscription header + every linked charge from
// subscription_charges, computes stats inline, and hands the payload
// to the client view component.
//
// Auth: scoped to the calling user's subscriptions. Cross-user
// access returns notFound() to avoid leaking the existence of an id.

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
  canonical_name: string | null;
};

export type ChargeRow = {
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

export type PriceChange = {
  cycle_from: number | null;
  cycle_to: number | null;
  date_from: string;
  date_to: string;
  amount_from_cents: number;
  amount_to_cents: number;
  delta_cents: number;
  delta_pct: number;
};

export default async function SubscriptionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!supabaseAdmin) {
    return (
      <section className="container-page py-16 md:py-24 max-w-[720px]">
        <p className="text-[15px] text-danger">
          Supabase is not configured.
        </p>
      </section>
    );
  }

  const subscriptionId = params.id;
  if (!/^[0-9a-f-]{36}$/i.test(subscriptionId)) {
    notFound();
  }

  // Header row — scoped to user_id so cross-user ids 404 silently.
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, user_id, merchant_name, category, amount_cents, currency, frequency, status, classification, last_charged_at, next_expected_charge_at, canonical_name"
    )
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sub) notFound();
  const subscription = sub as SubRow;

  // Full charge history (asc by date so cycle walking is stable).
  const { data: chargesData } = await supabaseAdmin
    .from("subscription_charges")
    .select(
      "id, posted_date, amount_cents, currency, detector_status, matched_by, cadence_cycle_id, raw_descriptor, scanner_version"
    )
    .eq("user_id", user.id)
    .eq("subscription_id", subscriptionId)
    .order("posted_date", { ascending: true });

  const charges = (chargesData ?? []) as ChargeRow[];

  // Stats over accepted charges only (real cadence spend).
  const accepted = charges.filter((c) => c.detector_status === "accepted");
  const outliers = charges.filter((c) => c.detector_status === "outlier");
  const totalChargedCents = accepted.reduce((a, b) => a + b.amount_cents, 0);
  const averageAmountCents = accepted.length
    ? Math.round(totalChargedCents / accepted.length)
    : 0;
  const highestCharge = accepted.reduce<ChargeRow | null>(
    (best, c) => (best === null || c.amount_cents > best.amount_cents ? c : best),
    null
  );
  const lowestCharge = accepted.reduce<ChargeRow | null>(
    (best, c) => (best === null || c.amount_cents < best.amount_cents ? c : best),
    null
  );
  const firstChargeDate = accepted[0]?.posted_date ?? null;
  const lastChargeDate = accepted[accepted.length - 1]?.posted_date ?? null;

  let monthsActive = 0;
  if (firstChargeDate && lastChargeDate) {
    const a = new Date(firstChargeDate);
    const b = new Date(lastChargeDate);
    monthsActive = Math.max(
      1,
      (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
        (b.getUTCMonth() - a.getUTCMonth()) +
        1
    );
  }

  let yearlySpendCents = 0;
  if (lastChargeDate) {
    const cutoff = new Date(lastChargeDate);
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    yearlySpendCents = accepted
      .filter((c) => c.posted_date >= cutoffIso)
      .reduce((a, c) => a + c.amount_cents, 0);
  }

  // Price-change timeline.
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

  return (
    <section className="container-page py-8 md:py-12 max-w-[1100px]">
      <div className="mb-6 md:mb-8">
        <Link
          href="/app/spending"
          className="inline-flex items-center gap-2 text-[13px] text-ink-muted hover:text-ink transition"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to your subs
        </Link>
      </div>

      <SubscriptionDetailView
        subscription={{
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
        }}
        stats={{
          total_charged_cents: totalChargedCents,
          average_amount_cents: averageAmountCents,
          yearly_spend_cents: yearlySpendCents,
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
        }}
        priceChanges={(await userHasAccess(user.id)) ? priceChanges : []}
        charges={charges}
      />
    </section>
  );
}
