import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/scan/latest
//
// Returns the most recent terminal-state scan for the current user.
// Used by the dashboard's tab-focus check: when a tab regains focus we
// hit this endpoint and compare `id` and `finished_at` against the
// values the dashboard rendered with. If they don't match a newer scan
// finished elsewhere (another tab, the webhook path, a mobile client),
// and we trigger `router.refresh()` to pull the fresh RSC payload.
//
// Design notes:
//   - Filters to status='done' so an in-flight finalize doesn't make us
//     think there's new data we should be showing.
//   - Indexed by (user_id, finished_at desc) where status='done' via
//     migration 008 — single index scan even with millions of rows.
//   - Returns null when the user has no completed scans yet rather than
//     404 so the client doesn't need to special-case error handling.

export const runtime = "nodejs";
export const maxDuration = 5;

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { data } = await supabaseAdmin
    .from("scan_runs")
    .select("id, finished_at, detected_count, status")
    .eq("user_id", user.id)
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Belt-and-suspenders cache header. Even if a proxy decides to cache
  // this, the must-revalidate forces re-validation; private prevents
  // any shared cache from holding it across users.
  return NextResponse.json(
    {
      latest: data
        ? {
            id: data.id as string,
            finished_at: data.finished_at as string | null,
            detected_count: (data.detected_count ?? 0) as number,
          }
        : null,
    },
    {
      headers: { "Cache-Control": "private, no-store, must-revalidate" },
    }
  );
}
