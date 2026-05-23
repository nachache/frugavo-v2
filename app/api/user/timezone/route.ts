import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/user/timezone
//
// Captures the user's browser timezone (IANA string, e.g.
// "America/New_York") so the daily monitoring cron can run at user-
// local 6am instead of UTC 6am.
//
// Fired by a tiny client hook on every dashboard mount. We only
// overwrite the stored value when it differs from what's already on
// the row — saves a database write 99% of the time and avoids
// thrashing rows after every refresh.
//
// IANA validation is intentionally loose: we accept anything matching
// `Region/City` shape. If the browser sends garbage, the cron handler
// falls back to America/New_York for that user.

export const runtime = "nodejs";

const TZ_RE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+\-]+)+$/;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "config" }, { status: 500 });
  }

  let timezone: string | null = null;
  try {
    const body = (await req.json()) as { timezone?: unknown };
    if (typeof body.timezone === "string" && TZ_RE.test(body.timezone)) {
      timezone = body.timezone;
    }
  } catch {
    // ignore malformed body
  }

  if (!timezone) {
    return NextResponse.json(
      { error: "invalid_timezone" },
      { status: 400 }
    );
  }

  // Only write when it changed. Read first to avoid update churn.
  const { data: row } = await supabaseAdmin
    .from("app_users")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  if (row?.timezone === timezone) {
    return NextResponse.json({ ok: true, updated: false, timezone });
  }

  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ timezone, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, updated: true, timezone });
}
