import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runScanForUser } from "@/lib/scan";
import { verifyPlaidWebhookJwt } from "@/lib/plaid-webhook";
import { observeError } from "@/lib/observe";

// Plaid webhook receiver.
//
// Contract from Plaid: they retry on any non-2xx within 10s, so the
// handler must return 200 quickly and do heavy work async. We:
//   1. Verify the JWT signature header against the raw body sha256.
//   2. Dedup on body.request_id (PK uniqueness handles double delivery).
//   3. Branch on webhook_code; the only code that triggers a scan today
//      is RECURRING_TRANSACTIONS_UPDATE.
//   4. Respond 200 fast; the scan runs in a fire-and-forget promise.
//
// Production note: the signature verification here uses the JWT's
// embedded request_body_sha256 claim. The "real" Plaid flow also fetches
// /webhook_verification_key/get and validates the JWT against that key.
// That call is added in the production hardening pass (see TODO).

export const runtime = "nodejs";
export const maxDuration = 10;

type PlaidWebhook = {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  request_id?: string;
  error?: { error_code: string; error_message: string } | null;
};

export async function POST(req: Request) {
  const raw = await req.text();
  const sigHeader = req.headers.get("plaid-verification") ?? "";

  const ok = await verifyPlaidWebhookJwt(raw, sigHeader);
  if (!ok) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let body: PlaidWebhook;
  try {
    body = JSON.parse(raw) as PlaidWebhook;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  // Idempotency. The unique PK on webhook_id makes the second delivery
  // raise 23505 (unique_violation), which we treat as "already processed".
  const webhookId =
    body.request_id ??
    `${body.item_id}:${body.webhook_code}:${Math.floor(Date.now() / 1000)}`;

  const { error: dupErr } = await supabaseAdmin
    .from("plaid_webhook_events")
    .insert({
      webhook_id: webhookId,
      item_id: body.item_id,
      webhook_type: body.webhook_type,
      webhook_code: body.webhook_code,
      raw_body: body,
    });

  if (dupErr && dupErr.code === "23505") {
    return NextResponse.json({ ok: true, dedup: true });
  }

  // Find the user_id for this item so the async scan can be attributed.
  const { data: item } = await supabaseAdmin
    .from("plaid_items")
    .select("user_id")
    .eq("plaid_item_id", body.item_id)
    .maybeSingle();

  // Branch on code. Anything we don't recognize is logged and ack'd.
  //
  // v9 — Three transaction-data webhook codes now trigger a scan,
  // not just RECURRING_TRANSACTIONS_UPDATE:
  //
  //   SYNC_UPDATES_AVAILABLE — fires when /transactions/sync has new
  //     updates ready. THIS is the critical one for new connections:
  //     when Plaid finishes pulling a user's initial transaction
  //     history (10-60s after bank connect), this code arrives.
  //     Without it, the first scan ran on an empty Plaid backend and
  //     the user landed on an empty dashboard — the bug the user
  //     reported as "first scan finds nothing, re-scan after trial
  //     works."
  //
  //   INITIAL_UPDATE — legacy transactions code, kept as a fallback
  //     for older Plaid item configurations that haven't fully
  //     migrated to /transactions/sync. Same semantics: initial pull
  //     is complete, data is ready.
  //
  //   RECURRING_TRANSACTIONS_UPDATE — Plaid's own recurring
  //     enrichment update. Still triggers a re-scan because it can
  //     deliver fresh status/pfc enrichment our engine reads.
  //
  // All three fire a fire-and-forget scan; we must 200 inside Plaid's
  // 10s retry window.
  const transactionDataReady =
    body.webhook_type === "TRANSACTIONS" &&
    (body.webhook_code === "SYNC_UPDATES_AVAILABLE" ||
      body.webhook_code === "INITIAL_UPDATE" ||
      body.webhook_code === "RECURRING_TRANSACTIONS_UPDATE");

  const nowIso = new Date().toISOString();

  // Always stamp webhook telemetry. The IngestionState diagnostics
  // read last_webhook_at to confirm Plaid is alive for this item.
  await supabaseAdmin
    .from("plaid_items")
    .update({
      last_webhook_at: nowIso,
      last_webhook_code: body.webhook_code,
    })
    .eq("plaid_item_id", body.item_id);

  if (transactionDataReady) {
    // Plaid has fresh transactions. Mark the item as syncing (the scan
    // we kick off below will flip it to ready / awaiting_bank when it
    // terminates). needs_refresh stays for back-compat.
    await supabaseAdmin
      .from("plaid_items")
      .update({
        needs_refresh: true,
        sync_state: "syncing",
        updated_at: nowIso,
      })
      .eq("plaid_item_id", body.item_id);

    if (item?.user_id) {
      // Fire-and-forget. We must 200 before the 10s retry window.
      // This is what makes ingestion browser-independent — the user
      // can close the tab right after Plaid Link completes and the
      // scan still runs whenever Plaid delivers.
      void runScanForUser(item.user_id, "webhook").catch((e) => {
        observeError(e, {
          route: "webhook.scan",
          tags: {
            itemId: body.item_id,
            webhookCode: body.webhook_code,
          },
        });
      });
    }
  } else if (body.webhook_code === "ITEM_LOGIN_REQUIRED") {
    // User-action-required state. The dashboard router reads
    // sync_state and surfaces NeedsReauthScreen. status is also
    // updated so the legacy item-listing surfaces still tag the row.
    await supabaseAdmin
      .from("plaid_items")
      .update({
        status: "login_required",
        sync_state: "needs_reauth",
        last_error_code: "ITEM_LOGIN_REQUIRED",
        last_error_at: nowIso,
        updated_at: nowIso,
      })
      .eq("plaid_item_id", body.item_id);
  } else if (body.webhook_code === "PENDING_EXPIRATION") {
    await supabaseAdmin
      .from("plaid_items")
      .update({
        status: "pending_expiration",
        sync_state: "needs_reauth",
        last_error_code: "PENDING_EXPIRATION",
        last_error_at: nowIso,
        updated_at: nowIso,
      })
      .eq("plaid_item_id", body.item_id);
  } else if (body.webhook_code === "ERROR" && body.error?.error_code) {
    // Plaid raised an item-level error. Flag the row so the
    // IngestionState selector / NeedsReauthScreen can surface it.
    const code = body.error.error_code;
    const isReauth =
      code === "INVALID_CREDENTIALS" ||
      code === "USER_PERMISSION_REVOKED" ||
      code === "ITEM_LOGIN_REQUIRED";
    await supabaseAdmin
      .from("plaid_items")
      .update({
        sync_state: isReauth ? "needs_reauth" : "error",
        last_error_code: code,
        last_error_at: nowIso,
        updated_at: nowIso,
      })
      .eq("plaid_item_id", body.item_id);
  }

  await supabaseAdmin
    .from("plaid_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("webhook_id", webhookId);

  return NextResponse.json({ ok: true });
}

// Verification logic lives in lib/plaid-webhook.ts — full ES256 JWS
// verify against Plaid's fetched public key, plus body sha256 match
// and 5-minute replay window.
