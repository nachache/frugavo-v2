import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { supabaseAdmin } from "@/lib/supabase";
import { encryptToken } from "@/lib/crypto";
import { runScanForUser } from "@/lib/scan";

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
// v8 — maxDuration extended to 60s so the background runScanForUser
// promise can complete inside the same lambda lifetime after this
// route's HTTP response is sent. Without this, Netlify's default 10s
// cap kills the in-flight scan promise and the user lands on a
// scan_runs row that never finalizes.
export const maxDuration = 60;

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

    // v8 — Bug #1 fix: kick the first-scan pipeline asynchronously so
    // the /app/scanning page can subscribe to live SSE events as the
    // engine emits them. Without this kick-here-async pattern, the
    // scan would run synchronously inside the scanning page's render
    // (the previous behavior) and the progress bar would only see
    // events replayed in bulk AFTER the scan was already complete.
    //
    // We poll scan_runs briefly for the new row's id so the client
    // can navigate to /app/scanning?scan_id=<id> with a valid id.
    // The runScanForUser promise is intentionally NOT awaited; it
    // continues running for the remainder of this lambda's lifetime
    // (maxDuration=60). Errors are logged, not propagated — the user
    // is already on the scanning page by then and will see SSE
    // events deliver the failure if it happens.
    const scanPromise = runScanForUser(user.id, "first_connect").catch(
      (e: unknown) => {
        // eslint-disable-next-line no-console
        console.error("[plaid/exchange] background scan failed:", e);
        return null;
      }
    );
    // Keep a reference so the runtime doesn't garbage-collect the
    // promise before it completes. Stored on globalThis so multiple
    // concurrent exchanges don't trample each other.
    const globalAny = globalThis as { __bgScanPromises?: Promise<unknown>[] };
    globalAny.__bgScanPromises = (globalAny.__bgScanPromises ?? []).concat(
      scanPromise
    );

    // Poll briefly for the scan_runs row runScanForUser inserts at
    // start. The row appears within ~50ms once the lock is acquired;
    // we cap the wait at 2s so a slow Redis lock doesn't block the
    // exchange response indefinitely.
    let scanId: string | null = null;
    for (let i = 0; i < 20; i++) {
      const { data } = await supabaseAdmin
        .from("scan_runs")
        .select("id, started_at")
        .eq("user_id", user.id)
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        scanId = data.id;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    return NextResponse.json({
      ok: true,
      item_id: itemId,
      // scan_id may be null if the scan_runs insert hasn't landed in
      // 2s (e.g. Redis lock contention). The client falls back to
      // navigating /app/scanning without a scan_id, where the page
      // does its own discovery (existing branch).
      scan_id: scanId,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[plaid/exchange] error:", e);
    return NextResponse.json(
      { error: "Token exchange failed" },
      { status: 500 }
    );
  }
}
