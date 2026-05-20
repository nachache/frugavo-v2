import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { runWatcherForUser } from "@/lib/watcher";

// POST /api/cancellations/watch
//
// Runs the watcher for the current Clerk user. Used by the dashboard
// "Check pending cancellations" button so users can force a refresh
// without waiting for the scheduled cron.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(_req: Request) {
  void _req;
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runWatcherForUser(user.id);
  return NextResponse.json({ ok: true, ...result });
}
