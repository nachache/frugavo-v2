import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/monitoring/alerts?status=active&limit=50
//   Returns the user's alerts ordered newest-first.
//
// POST /api/monitoring/alerts
//   Body: { alert_id, action: "acknowledge" | "dismiss" }
//   Updates alert status.

export const runtime = "nodejs";

const VALID_STATUS = new Set(["active", "acknowledged", "dismissed", "resolved"]);
const VALID_ACTION = new Set(["acknowledge", "dismiss"]);

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "active";
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? "50"))
  );

  const { data, error } = await supabaseAdmin
    .from("monitoring_alerts")
    .select(
      "id, subscription_id, merchant_key, merchant_name, alert_type, severity, status, details, created_at, acknowledged_at, dismissed_at"
    )
    .eq("user_id", user.id)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return NextResponse.json(
      { error: "read_failed", details: error.message },
      { status: 500 }
    );
  }

  // Filter out alerts tied to non-subscription subs (bills, commerce).
  // The protection product is about catching SUBSCRIPTION surprises —
  // a price hike on your mortgage or a missed renewal on a utility
  // isn't actionable in the same way. We fetch the user's
  // subscription→tier map once and exclude alerts whose subscription_id
  // is in the non-sub set.
  const { data: subTierRows } = await supabaseAdmin
    .from("subscriptions")
    .select("id, recurring_type")
    .eq("user_id", user.id);
  const nonSubIds = new Set(
    (subTierRows ?? [])
      .filter(
        (r) =>
          (r.recurring_type as string | null) !== "confirmed_subscription"
      )
      .map((r) => r.id as string)
  );
  const filtered = (data ?? []).filter(
    (a) => !a.subscription_id || !nonSubIds.has(a.subscription_id)
  );

  // Active count for the bell badge — recomputed against the filtered
  // set so the bell doesn't claim N alerts when only K are sub-tier.
  const activeCount = filtered.filter((a) => a.status === "active").length;

  return NextResponse.json(
    {
      alerts: filtered,
      active_count: activeCount,
    },
    { headers: { "Cache-Control": "private, no-store, must-revalidate" } }
  );
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: { alert_id?: string; action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const alertId = body.alert_id;
  const action = body.action;
  if (!alertId || !/^[0-9a-f-]{36}$/i.test(alertId)) {
    return NextResponse.json({ error: "alert_id_invalid" }, { status: 400 });
  }
  if (!action || !VALID_ACTION.has(action)) {
    return NextResponse.json({ error: "action_invalid" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const update =
    action === "acknowledge"
      ? { status: "acknowledged", acknowledged_at: nowIso }
      : { status: "dismissed", dismissed_at: nowIso };

  // Scoped to user_id — cross-user updates return 0 rows and we 404
  // (rather than 403, which would leak existence).
  const { data, error } = await supabaseAdmin
    .from("monitoring_alerts")
    .update(update)
    .eq("id", alertId)
    .eq("user_id", user.id)
    .select("id, status, acknowledged_at, dismissed_at")
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: "update_failed", details: error.message },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, alert: data });
}
