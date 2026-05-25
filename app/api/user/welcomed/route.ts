import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/user/welcomed
//
// Stamps app_users.welcomed_at = now() the first time the user finishes
// (or skips past) the onboarding reveal flow. The dashboard's
// /app/page.tsx redirects to /app/welcome whenever welcomed_at is null,
// so this is what breaks the user out of the reveal loop.
//
// Background — why this endpoint exists alongside the server-side
// stamp in /app/welcome:
//
//   The welcome reveal manages its stages (feedback → reveal → upsell
//   → preview) entirely client-side via setStage(). Only the FIRST
//   transition (feedback → reveal) writes ?stage=reveal to the URL
//   and triggers a server re-render that stamps welcomed_at. Every
//   subsequent stage flip is client-only.
//
//   If the server stamp fails or doesn't fire (e.g. the user goes
//   feedback → upsell without ever hitting ?stage=reveal in a real
//   refresh), the dashboard will keep redirecting them back to
//   /app/welcome, which restarts the upsell screen and creates the
//   "decline keeps cycling" bug.
//
//   This endpoint is a belt-and-braces guarantee: any exit path from
//   the reveal flow (decline, activate, manual close) calls it, so
//   welcomed_at is always set before the dashboard render runs.
//
// Idempotent — the IS NULL filter means subsequent calls no-op.

export const runtime = "nodejs";

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
    .update({ welcomed_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("welcomed_at", null);

  if (error) {
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
