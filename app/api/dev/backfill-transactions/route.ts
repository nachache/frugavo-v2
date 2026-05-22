import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeDescriptor } from "@/lib/merchant-normalize";
import rawTransactions from "@/tests/fixtures/raw-transactions.json";

// POST /api/dev/backfill-transactions
//
// One-off backfill: loads the calling user's real bank export (the
// xlsx-derived fixture at tests/fixtures/raw-transactions.json) into
// plaid_transactions. After this runs, the scan engine sees the same
// data via the standard plaid_transactions path — no special branching
// inside the engine.
//
// Idempotent: plaid_transactions has a unique constraint on
// (user_id, plaid_transaction_id); re-runs are safe.
//
// NOT for production users. Gated to env-allowlisted user IDs via
// FRUGAVO_SANDBOX_DEMO_USER_ID. Returns 403 for everyone else.
//
// This exists because Plaid sandbox returns its own seed data
// (KFC, McDonald's, GUSTO PAY, etc.) — completely unrelated to the
// real subscriptions we want to evaluate. The fixture file IS the
// user's real bank history, exported once and committed.

export const runtime = "nodejs";
export const maxDuration = 60;

type RawTxn = {
  date: string;
  type?: string;
  descriptor: string;
  amount_dollars: number;
  currency?: string;
};

export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Allowlist gate — only the env-named user can backfill.
  const allowed = process.env.FRUGAVO_SANDBOX_DEMO_USER_ID;
  if (!allowed || allowed !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pick a plaid_item row to attach the synthetic transactions to.
  // plaid_transactions.plaid_item_id is a FK so we need a real id.
  // First active item works.
  const { data: item } = await supabaseAdmin
    .from("plaid_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!item) {
    return NextResponse.json(
      { error: "no_plaid_item_found", hint: "Connect Plaid Link first" },
      { status: 400 }
    );
  }
  const plaidItemRowId = item.id as string;

  const txns = rawTransactions as RawTxn[];
  const outflows = txns.filter((t) => t.amount_dollars < 0);

  // Deterministic synthetic transaction_id: stable across reruns so
  // the unique constraint properly dedupes.
  function txnId(t: RawTxn, idx: number): string {
    const safe = `${t.date}_${idx}_${t.descriptor.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 40)}`;
    return `xlsx_${safe}`;
  }

  const rows = outflows.map((t, idx) => {
    const norm = normalizeDescriptor(t.descriptor);
    const baseKey = (norm.catalog_key ?? norm.merchant_name).toLowerCase();
    const amountDollars = Math.abs(t.amount_dollars);
    // Apply the same biller-bucketing rule lib/plaid-sync.ts uses, so
    // the demo data is processed by the engine identically to live
    // Plaid sync data.
    let merchantKey = baseKey;
    if (norm.biller_passthrough) {
      const tier =
        amountDollars < 50
          ? Math.floor(amountDollars / 5)
          : 10 + Math.floor(amountDollars / 20);
      merchantKey = `${baseKey}_t${tier}`;
    }
    return {
      user_id: user.id,
      plaid_item_id: plaidItemRowId,
      plaid_transaction_id: txnId(t, idx),
      plaid_stream_id: null,
      account_id: "xlsx_synthetic",
      // Negative = outflow, matches plaid_transactions convention.
      amount_cents: Math.round(t.amount_dollars * 100),
      currency: t.currency ?? "USD",
      iso_currency_code: t.currency ?? "USD",
      unofficial_currency_code: null,
      merchant_name: null,
      name: t.descriptor,
      description: t.descriptor,
      pfc_primary: null,
      pfc_detailed: null,
      authorized_date: null,
      posted_date: t.date,
      pending: false,
      raw: { source: "xlsx-backfill", ...t },
      normalized_descriptor: t.descriptor.toLowerCase().trim().replace(/\s+/g, " "),
      merchant_key: merchantKey,
      canonical_name: norm.merchant_name,
    };
  });

  // Upsert in chunks. Supabase limits payload size; 500 rows per call
  // is a safe upper bound.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("plaid_transactions")
      .upsert(chunk, {
        onConflict: "user_id,plaid_transaction_id",
        ignoreDuplicates: false,
      });
    if (error) {
      return NextResponse.json(
        { error: "upsert_failed", details: error.message, inserted },
        { status: 500 }
      );
    }
    inserted += chunk.length;
  }

  return NextResponse.json({
    ok: true,
    total_in_fixture: txns.length,
    outflows: outflows.length,
    upserted: inserted,
    plaid_item_id: plaidItemRowId,
  });
}
