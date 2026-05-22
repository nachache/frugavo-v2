import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { writeSubscriptionCharges } from "@/lib/scan";
import { randomUUID } from "node:crypto";
import {
  detectRecurringStreams,
  type TxnInput,
} from "@/lib/recurrence-detect";

// POST /api/dev/backfill-subscription-charges
//
// One-off Phase-4 backfill. Walks every subscription this user has and
// reconstructs subscription_charges from existing plaid_transactions
// rows. Does NOT re-run AI / classifier / Plaid — it only reproduces
// the deterministic "which charges belong to this stream" decision
// the engine would have made on the original scan.
//
// Why this exists:
//   Phase 4 launched after months of scans had already written
//   subscriptions but never wrote subscription_charges. Without this
//   endpoint the historical chart, yearly totals, and price-tracking
//   features would be empty until enough new scans accumulated. The
//   user explicitly wants real history "from day one" of Phase 4 —
//   not "starting from now forward."
//
// Determinism contract:
//   We run detectRecurringStreams on the subset of plaid_transactions
//   matching each subscription's merchant_key. That returns exactly
//   the same kept / outlier split the standard scan would have
//   produced, so the backfill output is byte-identical to a fresh
//   end-to-end scan's writes — minus the AI-normalization step,
//   which doesn't affect charge linkage at all.
//
// Idempotent: writeSubscriptionCharges upserts on
// (user_id, subscription_id, plaid_transaction_id). Safe to re-run.
//
// NOT for production. Gated to FRUGAVO_SANDBOX_DEMO_USER_ID.

export const runtime = "nodejs";
export const maxDuration = 60;

type SubscriptionRow = {
  id: string;
  merchant_key: string | null;
  classification_score: number | null;
};

type PlaidTxnRow = {
  plaid_transaction_id: string;
  posted_date: string;
  amount_cents: number;
  currency: string | null;
  description: string | null;
  merchant_key: string | null;
  canonical_name: string | null;
  normalized_descriptor: string | null;
  pfc_primary: string | null;
  pfc_detailed: string | null;
};

export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const allowed = process.env.FRUGAVO_SANDBOX_DEMO_USER_ID;
  if (!allowed || allowed !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Synthetic scan_run_id for this backfill. We do NOT insert a row
  // into scan_runs — that's reserved for real scans. The FK on
  // subscription_charges.scan_run_id is ON DELETE SET NULL, so an
  // orphan id is fine for tracking but won't fan out.
  const syntheticScanId = randomUUID();

  // ---- Pull all of this user's subscriptions ----
  const { data: subs, error: subsErr } = await supabaseAdmin
    .from("subscriptions")
    .select("id, merchant_key, classification_score")
    .eq("user_id", user.id)
    .not("merchant_key", "is", null);

  if (subsErr) {
    return NextResponse.json(
      { error: "subscriptions_read_failed", details: subsErr.message },
      { status: 500 }
    );
  }
  const subscriptions = (subs ?? []) as SubscriptionRow[];

  const results: Array<{
    subscription_id: string;
    merchant_key: string;
    txns_found: number;
    accepted_written: number;
    outliers_written: number;
    note?: string;
  }> = [];

  for (const sub of subscriptions) {
    if (!sub.merchant_key) continue;

    // ---- Pull plaid_transactions for this merchant_key (paginated) ----
    const txns: PlaidTxnRow[] = [];
    let offset = 0;
    const PAGE = 1000;
    while (offset < 100_000) {
      const { data, error } = await supabaseAdmin
        .from("plaid_transactions")
        .select(
          "plaid_transaction_id, posted_date, amount_cents, currency, description, merchant_key, canonical_name, normalized_descriptor, pfc_primary, pfc_detailed"
        )
        .eq("user_id", user.id)
        .eq("merchant_key", sub.merchant_key)
        .eq("pending", false)
        .order("posted_date", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) break;
      const page = (data ?? []) as PlaidTxnRow[];
      txns.push(...page);
      if (page.length < PAGE) break;
      offset += PAGE;
    }

    if (txns.length === 0) {
      results.push({
        subscription_id: sub.id,
        merchant_key: sub.merchant_key,
        txns_found: 0,
        accepted_written: 0,
        outliers_written: 0,
        note: "no_matching_plaid_transactions",
      });
      continue;
    }

    // ---- Convert + detect ----
    const txnInputs: TxnInput[] = txns.map((r) => ({
      txn_id: r.plaid_transaction_id,
      date: r.posted_date,
      amount_dollars: (r.amount_cents ?? 0) / 100,
      currency: r.currency ?? "USD",
      raw_descriptor: r.description ?? "",
      merchant_key: r.merchant_key ?? "",
      canonical_name: r.canonical_name ?? "",
      normalized_descriptor: r.normalized_descriptor ?? "",
      pfc_primary: r.pfc_primary,
      pfc_detailed: r.pfc_detailed,
    }));

    const { streams } = detectRecurringStreams(txnInputs);
    // Among detected streams (probably exactly one for a single
    // merchant_key), find the matching one. If detection rejected the
    // group (e.g. only 1 charge survives), fall back to writing every
    // txn as an outlier so the user still gets their full history.
    const stream = streams.find((s) => s.merchant_key === sub.merchant_key);

    if (!stream) {
      // No recurrence pattern, but the subscription exists — write
      // every matching txn as outlier so history isn't blank.
      const synthetic = {
        merchant_key: sub.merchant_key,
        canonical_name: txnInputs[0]?.canonical_name ?? "",
        representative_descriptor: txnInputs[0]?.raw_descriptor ?? "",
        normalized_descriptor: txnInputs[0]?.normalized_descriptor ?? "",
        occurrences: 0,
        median_gap_days: 0,
        frequency: "MONTHLY" as const,
        average_amount_dollars: 0,
        median_amount_dollars: 0,
        currency: txnInputs[0]?.currency ?? "USD",
        last_date: txnInputs[txnInputs.length - 1]?.date ?? "",
        next_expected_date: "",
        transactions: [],
        outliers: txnInputs,
        pfc_primary: null,
        pfc_detailed: null,
      };
      await writeSubscriptionCharges({
        userId: user.id,
        subscriptionId: sub.id,
        scanId: syntheticScanId,
        stream: synthetic,
        confidence: sub.classification_score ?? 0,
      });
      results.push({
        subscription_id: sub.id,
        merchant_key: sub.merchant_key,
        txns_found: txnInputs.length,
        accepted_written: 0,
        outliers_written: txnInputs.length,
        note: "no_recurrence_pattern_history_written_as_outliers",
      });
      continue;
    }

    await writeSubscriptionCharges({
      userId: user.id,
      subscriptionId: sub.id,
      scanId: syntheticScanId,
      stream,
      confidence: sub.classification_score ?? 0,
    });

    results.push({
      subscription_id: sub.id,
      merchant_key: sub.merchant_key,
      txns_found: txnInputs.length,
      accepted_written: stream.transactions.length,
      outliers_written: stream.outliers.length,
    });
  }

  const totals = results.reduce(
    (acc, r) => {
      acc.accepted += r.accepted_written;
      acc.outliers += r.outliers_written;
      acc.subs_with_history += r.accepted_written + r.outliers_written > 0 ? 1 : 0;
      return acc;
    },
    { accepted: 0, outliers: 0, subs_with_history: 0 }
  );

  return NextResponse.json({
    ok: true,
    subscriptions_processed: subscriptions.length,
    subscriptions_with_history: totals.subs_with_history,
    accepted_charges_written: totals.accepted,
    outlier_charges_written: totals.outliers,
    synthetic_scan_id: syntheticScanId,
    per_subscription: results,
  });
}
