import { NextResponse } from "next/server";
import {
  listUsersWithPendingCancellations,
  runWatcherForUser,
} from "@/lib/watcher";

// GET /api/cron/watcher
//
// Scheduled daily watcher run across every user with pending
// cancellations. Authenticated via a shared CRON_SECRET header so
// random callers can't hammer the endpoint. Wire this to:
//   - Upstash QStash (recommended, retry semantics + dead letter)
//   - Netlify Scheduled Functions
//   - GitHub Actions cron
// with `Authorization: Bearer <CRON_SECRET>` set.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIds = await listUsersWithPendingCancellations();

  let totalProcessed = 0;
  let totalConfirmed = 0;
  let totalFailed = 0;
  let totalStillPending = 0;

  // Sequential to keep DB load predictable. With more users we'd batch
  // this via QStash fanout, but for now linear is fine.
  for (const uid of userIds) {
    const r = await runWatcherForUser(uid);
    totalProcessed += r.processed;
    totalConfirmed += r.confirmed;
    totalFailed += r.failed;
    totalStillPending += r.stillPending;
  }

  return NextResponse.json({
    ok: true,
    users: userIds.length,
    processed: totalProcessed,
    confirmed: totalConfirmed,
    failed: totalFailed,
    stillPending: totalStillPending,
  });
}
