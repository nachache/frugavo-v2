import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/scan/status?id=<scan_id>
//
// Polling fallback for the SSE stream. If a Redis event got dropped or
// the SSE connection bounced, the StreamingList component still hits
// this every 3 seconds to ask "is the scan actually done?" — the DB
// scan_runs row is the canonical truth.
//
// Returns:
//   status: 'running' | 'done' | 'error' | 'timeout'
//   detected: number of subscriptions found so far
//   duration_ms: scan duration if finished
//
// Authorization: the scan must belong to the current Clerk user.

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { data: run } = await supabaseAdmin
    .from("scan_runs")
    .select(
      "id, user_id, status, detected_count, started_at, finished_at, duration_ms"
    )
    .eq("id", id)
    .maybeSingle();

  if (!run || run.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: run.status as "running" | "done" | "error" | "timeout",
    detected: (run.detected_count ?? 0) as number,
    started_at: run.started_at as string,
    finished_at: run.finished_at as string | null,
    duration_ms: run.duration_ms as number | null,
  });
}
