import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/learning/duplicate-dismiss
//
// Body: { alert_id: string }
//
// Records that the user explicitly said a duplicate_subscription
// alert was not actually a duplicate. We:
//   1. Pull the alert's `root` + `plaid_stream_ids` from its details
//      payload (set by detectDuplicateSubscriptions).
//   2. Upsert a row in duplicate_dismissals keyed on (user, root).
//   3. Mark the alert dismissed so the UI removes it immediately.
//
// The dismissal table feeds two things:
//   a. The detector consults it on subsequent scans to suppress the
//      same false positive — no re-surfacing of "Apple Music + Apple
//      TV are duplicates" once the user has said otherwise.
//   b. The accumulated dismissals become labelled training data for
//      the v2 semantic merchant matcher.
//
// Idempotent: unique (clerk_user_id, root) constraint means a second
// dismissal on the same root is a no-op.

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: { alert_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const alertId = body.alert_id;
  if (!alertId || typeof alertId !== "string") {
    return NextResponse.json({ error: "alert_id_required" }, { status: 400 });
  }

  // Fetch the alert, scoped to user.
  const { data: alert } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("id, user_id, alert_type, details")
    .eq("id", alertId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!alert) {
    return NextResponse.json({ error: "alert_not_found" }, { status: 404 });
  }
  if (alert.alert_type !== "duplicate_subscription") {
    return NextResponse.json(
      { error: "wrong_alert_type", expected: "duplicate_subscription" },
      { status: 400 }
    );
  }

  const details = (alert.details ?? {}) as {
    root?: string;
    plaid_stream_ids?: string[];
  };
  const root = details.root;
  const streamIds = Array.isArray(details.plaid_stream_ids)
    ? details.plaid_stream_ids
    : [];
  if (!root) {
    return NextResponse.json({ error: "alert_missing_root" }, { status: 400 });
  }

  // Upsert dismissal. Unique on (clerk_user_id, root) makes this
  // idempotent — a re-click is a no-op.
  const { error: writeErr } = await supabaseAdmin
    .from("duplicate_dismissals")
    .upsert(
      {
        clerk_user_id: user.id,
        root,
        stream_ids: streamIds,
        alert_id: alertId,
      },
      { onConflict: "clerk_user_id,root" }
    );
  if (writeErr) {
    return NextResponse.json(
      { error: "write_failed", details: writeErr.message },
      { status: 500 }
    );
  }

  // Also mark the alert dismissed so the UI hides it instantly.
  await supabaseAdmin
    .from("monitoring_alerts")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", alertId)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
