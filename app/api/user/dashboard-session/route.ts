import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/user/dashboard-session
//
// Stamps app_users.dashboard_first_session_at the first time the user
// has either been on /app for ≥12 seconds with the tab visible, or
// has actively interacted (click / scroll / keydown). The
// DashboardSessionPinger client component owns the trigger logic;
// this route is just the idempotent server-side latch.
//
// Used as the release signal for the urgent-alert onboarding grace
// in lib/notifications/dispatch.ts. Stricter than welcomed_at, which
// can land from an accidental refresh on the Stripe-success path.
//
// Idempotent — the IS NULL gate means the second call is a no-op.

export const runtime = "nodejs";
export const maxDuration = 5;

export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ dashboard_first_session_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("dashboard_first_session_at", null);

  if (error) {
    return NextResponse.json(
      { error: "session_stamp_failed", details: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
