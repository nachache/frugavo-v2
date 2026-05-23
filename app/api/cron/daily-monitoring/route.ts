import { NextResponse } from "next/server";
import { runDailyMonitoringSweep } from "@/lib/cron/daily-monitoring";

// GET /api/cron/daily-monitoring
//
// Hourly Netlify scheduled function calls this endpoint with the
// CRON_SECRET in the Authorization header. The handler delegates to
// runDailyMonitoringSweep() which figures out which timezones are at
// local 6am and sweeps the matching users.
//
// Returns the sweep summary as JSON so Netlify function logs capture
// observable counts (matched, scanned, skipped, failed).
//
// We intentionally don't time-budget the route. Each user takes ~3-8s
// to scan; on a sweep of, say, 50 users that's ~5min, well under
// Netlify's 15min scheduled-function ceiling. If the sweep ever runs
// long enough that the cron times out, we switch to QStash fanout —
// one message per user — at that point.

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — comfortable for moderate user counts

export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailyMonitoringSweep();
  return NextResponse.json(result);
}

// Manual trigger path — same auth — useful for testing a specific
// user without waiting for their local 6am.
//
// Body: { user_ids: string[] }
export async function POST(req: Request) {
  const secret = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userIds: string[] = [];
  try {
    const body = (await req.json()) as { user_ids?: unknown };
    if (Array.isArray(body.user_ids)) {
      userIds = body.user_ids.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // empty body is fine — falls back to a regular sweep
  }

  const result = await runDailyMonitoringSweep(
    userIds.length > 0 ? { forceUserIds: userIds } : {}
  );
  return NextResponse.json(result);
}
