import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/dev/list-subscriptions
//
// Dev-only helper. Lists every subscription row this user has with
// just enough columns to copy an ID into the charges-API URL during
// Phase 4 spot-checks. NOT for production — gated to
// FRUGAVO_SANDBOX_DEMO_USER_ID.

export const runtime = "nodejs";

export async function GET() {
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

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, merchant_name, category, amount_cents, frequency, status, classification")
    .eq("user_id", user.id)
    .order("amount_cents", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "read_failed", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    count: (data ?? []).length,
    subscriptions: (data ?? []).map((r) => ({
      id: r.id,
      name: r.merchant_name,
      category: r.category,
      amount: ((r.amount_cents as number) ?? 0) / 100,
      frequency: r.frequency,
      status: r.status,
      classification: r.classification,
    })),
  });
}
