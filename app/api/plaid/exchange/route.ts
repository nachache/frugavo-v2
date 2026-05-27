import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { supabaseAdmin } from "@/lib/supabase";
import { encryptToken } from "@/lib/crypto";
import { runScanForUser } from "@/lib/scan";
import { observeError } from "@/lib/observe";

// POST /api/plaid/exchange
// Body: { public_token: string, institution?: { name, institution_id } }
//
// Called from the React Connect button when Plaid Link finishes
// successfully. We exchange the short-lived public_token for a permanent
// access_token, then persist a plaid_items row tied to the Clerk user.
//
// The access_token is the keystone credential — anyone with it can read
// the user's bank transactions. It MUST be encrypted at rest before
// production. For sandbox we store it in plaintext; a separate encryption
// pass will land before production access is requested from Plaid.

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!plaidClient || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Plaid or Supabase is not configured on the server" },
      { status: 503 }
    );
  }

  let body: {
    public_token?: string;
    institution?: { name?: string; institution_id?: string } | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.public_token) {
    return NextResponse.json(
      { error: "Missing public_token" },
      { status: 400 }
    );
  }

  try {
    // 1. Exchange the public_token for a permanent access_token + item_id.
    const exchange = await plaidClient.itemPublicTokenExchange({
      public_token: body.public_token,
    });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    // 2. Persist the connection. The unique constraint on plaid_item_id
    //    means re-connecting the same institution is a no-op (upsert).
    const { error } = await supabaseAdmin
      .from("plaid_items")
      .upsert(
        {
          user_id: user.id,
          plaid_item_id: itemId,
          plaid_access_token: encryptToken(accessToken),
          institution_name: body.institution?.name ?? null,
          institution_id: body.institution?.institution_id ?? null,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "plaid_item_id" }
      );

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[plaid/exchange] supabase insert failed:", error);
      return NextResponse.json(
        { error: "Failed to save connection" },
        { status: 500 }
      );
    }

    // v11 — fire-and-forget the first scan as a background job so
    // the browser is free to navigate to /app immediately. The
    // IngestionState selector on /app reads plaid_items.sync_state
    // (pending → syncing → ready) and surfaces PreparingScreen with
    // real milestones. The user can close the tab after this point
    // and the webhook (SYNC_UPDATES_AVAILABLE / INITIAL_UPDATE) will
    // re-trigger the scan whenever Plaid delivers.
    //
    // We do NOT redirect to /app/scanning anymore. That page exists
    // only for the live SSE reveal — the dashboard route's
    // PreparingScreen is the production-grade waiting state.
    void runScanForUser(user.id, "first_connect").catch((e) => {
      observeError(e, {
        route: "plaid.exchange.scan",
        tags: { itemId, userId: user.id },
      });
    });

    return NextResponse.json({ ok: true, item_id: itemId });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[plaid/exchange] error:", e);
    return NextResponse.json(
      { error: "Token exchange failed" },
      { status: 500 }
    );
  }
}
