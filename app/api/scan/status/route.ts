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
//   status: 'running' | 'finalizing' | 'done' | 'error' | 'timeout'
//   detected: number of subscriptions found so far
//   duration_ms: scan duration if finished
//
// State-machine contract (mirrors lib/scan.ts):
//   - 'running' and 'finalizing' are non-terminal. The client must NOT
//     render the snapshot yet — rows may be in flight (running) or the
//     cache invalidation may not have propagated (finalizing).
//   - 'done', 'error', 'timeout' are terminal. The client is free to
//     refetch and render.
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
      "id, user_id, status, detected_count, started_at, finished_at, duration_ms, metrics"
    )
    .eq("id", id)
    .maybeSingle();

  if (!run || run.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const status = run.status as
    | "running"
    | "finalizing"
    | "done"
    | "error"
    | "timeout";

  // v11 — surface the awaiting_bank_data flag stamped into scan_runs.metrics
  // so a polling client (which can't rely on the live SSE stream after
  // the 60s replay window) can still recover the slow-bank state on
  // page reload. The flag is set by lib/scan.ts when a first_connect
  // scan finishes with zero rows because Plaid hasn't delivered yet.
  const metrics = (run.metrics ?? null) as
    | { awaiting_bank_data?: boolean }
    | null;
  const awaitingBankData = Boolean(metrics?.awaiting_bank_data);

  return NextResponse.json({
    status,
    // The client uses `is_terminal` rather than string-matching so a
    // future status name (e.g. "cancelled" if we add user-aborted scans)
    // doesn't silently get treated as terminal by stale clients.
    is_terminal: status === "done" || status === "error" || status === "timeout",
    detected: (run.detected_count ?? 0) as number,
    started_at: run.started_at as string,
    finished_at: run.finished_at as string | null,
    duration_ms: run.duration_ms as number | null,
    awaiting_bank_data: awaitingBankData,
  });
}
