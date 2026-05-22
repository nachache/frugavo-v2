import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/subscriptions/:id/charges
//
// Phase 4 read endpoint. Returns the real billing-history rows for a
// subscription, ordered newest-first.
//
// Response shape is deliberately flat and stable — the detail-page
// chart, the yearly-total widget, the export-to-CSV path, and the
// upcoming price-tracking detector all read this same payload.
//
// Query params:
//   limit             default 365, hard cap 1000
//   include_outliers  default true. Set to "false" to hide drift-
//                     rejected charges (taxes, FX swings, annual
//                     true-ups). The detail page shows them by
//                     default with a subtle "unusual charge" tag;
//                     CSV export and totals can opt out.
//   since             optional YYYY-MM-DD lower bound (inclusive).
//                     Used by the 12-month chart to avoid pulling
//                     years of data into the client.
//
// Auth: standard Clerk session. We scope to the calling user's
// subscriptions only — a user cannot read another user's charge
// history.

export const runtime = "nodejs";

type ChargeRow = {
  id: string;
  posted_date: string;
  amount_cents: number;
  currency: string;
  detector_status: "accepted" | "outlier" | "ignored";
  matched_by: "merchant_key" | "biller_tier" | "manual";
  confidence: number | null;
  cadence_cycle_id: number | null;
  raw_descriptor: string | null;
  merchant_key: string | null;
  scanner_version: string;
  created_at: string;
};

export async function GET(
  req: NextRequest,
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

  // Verify the subscription belongs to this user before exposing its
  // charge history. Cheap header-only read.
  const { data: sub, error: subErr } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, merchant_name, amount_cents, currency, frequency")
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

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "365");
  const limit = Math.min(Math.max(1, isFinite(limitParam) ? limitParam : 365), 1000);
  const includeOutliers =
    (url.searchParams.get("include_outliers") ?? "true").toLowerCase() !== "false";
  const since = url.searchParams.get("since");

  let q = supabaseAdmin
    .from("subscription_charges")
    .select(
      "id, posted_date, amount_cents, currency, detector_status, matched_by, confidence, cadence_cycle_id, raw_descriptor, merchant_key, scanner_version, created_at"
    )
    .eq("user_id", user.id)
    .eq("subscription_id", subscriptionId)
    .order("posted_date", { ascending: false })
    .limit(limit);

  if (!includeOutliers) {
    q = q.eq("detector_status", "accepted");
  }
  if (since && /^\d{4}-\d{2}-\d{2}$/.test(since)) {
    q = q.gte("posted_date", since);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json(
      { error: "charges_read_failed", details: error.message },
      { status: 500 }
    );
  }

  const charges = (data ?? []) as ChargeRow[];

  // Quick aggregates so the chart can render header stats without a
  // second round-trip. Computed over the returned window only.
  const acceptedOnly = charges.filter((c) => c.detector_status === "accepted");
  const sumCents = acceptedOnly.reduce((acc, c) => acc + c.amount_cents, 0);
  const lastDate = charges[0]?.posted_date ?? null;
  const firstDate = charges[charges.length - 1]?.posted_date ?? null;

  return NextResponse.json({
    subscription: {
      id: sub.id,
      merchant_name: sub.merchant_name,
      amount_cents: sub.amount_cents,
      currency: sub.currency,
      frequency: sub.frequency,
    },
    window: {
      count: charges.length,
      accepted_count: acceptedOnly.length,
      outlier_count: charges.length - acceptedOnly.length,
      first_charge_date: firstDate,
      last_charge_date: lastDate,
      sum_cents_accepted: sumCents,
    },
    charges,
  });
}
