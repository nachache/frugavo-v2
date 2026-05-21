import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken } from "@/lib/crypto";

// POST /api/plaid/disconnect
//
// Disconnects a Plaid item: calls /item/remove to revoke our access
// token with Plaid (so we can never query their bank again), then marks
// the local row as removed. We keep the row for audit + so any related
// subscriptions can still reference it; status='removed' hides it from
// the scan loop.
//
// Body: { item_id: string }  (the local Supabase uuid, not the Plaid id)

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin || !plaidClient) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: { item_id?: string };
  try {
    body = (await req.json()) as { item_id?: string };
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  if (!body.item_id) {
    return NextResponse.json({ error: "item_id required" }, { status: 400 });
  }

  // Verify ownership before touching anything.
  const { data: item } = await supabaseAdmin
    .from("plaid_items")
    .select("id, user_id, plaid_access_token, plaid_item_id")
    .eq("id", body.item_id)
    .maybeSingle();

  if (!item || item.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort token revoke on Plaid's side. If this fails (token
  // already invalid, network blip) we still mark our row removed so the
  // user isn't stuck with a connection they think they cancelled.
  try {
    await plaidClient.itemRemove({
      access_token: decryptToken(item.plaid_access_token),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[disconnect] plaid itemRemove failed", e);
  }

  await supabaseAdmin
    .from("plaid_items")
    .update({
      status: "removed",
      plaid_access_token: "REVOKED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  return NextResponse.json({ ok: true });
}
