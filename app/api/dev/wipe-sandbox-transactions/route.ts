import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/dev/wipe-sandbox-transactions
//
// One-off cleanup: deletes plaid_transactions rows for the calling
// user that did NOT come from the xlsx backfill. The xlsx backfill
// route writes account_id="xlsx_synthetic"; anything else is real
// Plaid sync data — either sandbox seed (KFC, McDonald's, Starbucks,
// GUSTO PAY, Uber, etc.) or real bank data.
//
// In the pre-launch demo flow the demo user connected Plaid sandbox
// to wire the OAuth path, which left dummy transactions in the table.
// Those dummies have nothing to do with the user's actual subscription
// history (which lives in the xlsx fixture). This endpoint scrubs them
// so the scan engine only sees the xlsx-derived rows.
//
// Idempotent. Gated to env-allowlisted user via FRUGAVO_SANDBOX_DEMO_USER_ID.
// NOT for production.

export const runtime = "nodejs";
export const maxDuration = 30;

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

  // Count first so we can report what's being wiped without
  // surprising the caller.
  const { count: beforeCount } = await supabaseAdmin
    .from("plaid_transactions")
    .select("plaid_transaction_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Delete everything NOT tagged as xlsx_synthetic.
  const { error: delError, count: deletedCount } = await supabaseAdmin
    .from("plaid_transactions")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .neq("account_id", "xlsx_synthetic");

  if (delError) {
    return NextResponse.json(
      { error: "delete_failed", details: delError.message },
      { status: 500 }
    );
  }

  const { count: afterCount } = await supabaseAdmin
    .from("plaid_transactions")
    .select("plaid_transaction_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({
    ok: true,
    before: beforeCount ?? null,
    deleted: deletedCount ?? null,
    after: afterCount ?? null,
    note: "Only rows where account_id='xlsx_synthetic' remain.",
  });
}
