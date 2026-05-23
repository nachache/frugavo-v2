import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  localHourInTimezone,
  localDateInTimezone,
} from "@/lib/cron/daily-monitoring";
import { dispatchDigestForUser } from "@/lib/notifications/dispatch";

// GET /api/cron/notification-digest
//
// Hourly sweep. Fires the daily digest email for users whose local
// hour just became 7am — exactly one hour after the 6am monitoring
// scan so any alerts that came out of the sweep land in the digest.
//
// Idempotent: digest_key = `digest:USER:YYYY-MM-DD` (user's local
// date). The email_dispatches unique constraint on (digest_key,
// channel) blocks double-sends.

export const runtime = "nodejs";
export const maxDuration = 300;

const DIGEST_LOCAL_HOUR = 7;

export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const at = new Date();
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, reason: "no_supabase" });
  }

  const { data: tzRows } = await supabaseAdmin
    .from("app_users")
    .select("timezone")
    .not("timezone", "is", null);
  const distinctTzs = Array.from(
    new Set((tzRows ?? []).map((r) => r.timezone as string))
  );
  const matchedTzs = distinctTzs.filter(
    (tz) => localHourInTimezone(tz, at) === DIGEST_LOCAL_HOUR
  );

  if (matchedTzs.length === 0) {
    return NextResponse.json({ ok: true, matched_timezones: [], swept: 0 });
  }

  const { data: users } = await supabaseAdmin
    .from("app_users")
    .select("id, timezone")
    .in("timezone", matchedTzs);

  let swept = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of (users ?? []) as Array<{ id: string; timezone: string }>) {
    const runKey = localDateInTimezone(u.timezone, at) ?? "unknown";
    const digestKey = `digest:${u.id}:${runKey}`;
    const dateLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: u.timezone,
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(at);

    try {
      const r = await dispatchDigestForUser({
        userId: u.id,
        digestKey,
        digestDateLabel: dateLabel,
      });
      swept += 1;
      if (r.sent) sent += 1;
      else if (r.ok) skipped += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    matched_timezones: matchedTzs,
    swept,
    sent,
    skipped,
    failed,
  });
}
