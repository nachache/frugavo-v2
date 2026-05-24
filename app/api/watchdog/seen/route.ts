import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/watchdog/seen
//
// Marks the daily watchdog overlay as viewed for this user. Bumps
// app_users.watchdog_seen_at = now(). The next dashboard render
// computes "events since this timestamp"; if nothing new has
// happened, the overlay stays hidden.
//
// Idempotent. Safe to call on every dismiss without checking prior
// state.

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
    .update({ watchdog_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
