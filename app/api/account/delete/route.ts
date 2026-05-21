import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken } from "@/lib/crypto";

// POST /api/account/delete
//
// Hard-deletes the user's data:
//   1. Revokes every Plaid access token they have.
//   2. Truncates subscription_charges, cancellations, subscriptions,
//      scan_runs, ai_calls for this user_id.
//   3. Removes the app_users row.
//
// Clerk identity is NOT deleted here — the user is signed in via Clerk
// and can delete the Clerk account themselves through Clerk's account
// portal. We only own the data inside Supabase.
//
// Body: { confirm: "DELETE" }  — guard against accidental client calls.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: { confirm?: string };
  try {
    body = (await req.json()) as { confirm?: string };
  } catch {
    body = {};
  }
  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: "Confirmation phrase required" },
      { status: 400 }
    );
  }

  // Revoke Plaid tokens. We swallow errors here — even if Plaid fails,
  // we proceed with the local wipe so the user isn't trapped.
  const { data: items } = await supabaseAdmin
    .from("plaid_items")
    .select("plaid_access_token")
    .eq("user_id", user.id);

  if (items && plaidClient) {
    for (const it of items) {
      if (!it.plaid_access_token || it.plaid_access_token === "REVOKED") continue;
      try {
        await plaidClient.itemRemove({
          access_token: decryptToken(it.plaid_access_token),
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[account/delete] itemRemove failed", e);
      }
    }
  }

  // Order matters — children first to avoid FK constraint failures.
  await supabaseAdmin
    .from("subscription_charges")
    .delete()
    .eq("user_id", user.id);
  await supabaseAdmin.from("cancellations").delete().eq("user_id", user.id);
  await supabaseAdmin.from("subscriptions").delete().eq("user_id", user.id);
  await supabaseAdmin.from("scan_runs").delete().eq("user_id", user.id);
  await supabaseAdmin.from("ai_calls").delete().eq("user_id", user.id);
  await supabaseAdmin.from("plaid_items").delete().eq("user_id", user.id);
  await supabaseAdmin.from("app_users").delete().eq("id", user.id);

  return NextResponse.json({ ok: true });
}
