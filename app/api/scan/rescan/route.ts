import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { runScanForUser } from "@/lib/scan";
import { cacheKey, tryAcquireLock } from "@/lib/cache";
import { SCAN_BUDGET_MS } from "@/lib/types/scan";

// POST /api/scan/rescan
//
// Manual re-scan. Enforces the 30s server-side cooldown via SETNX in
// Redis: the first call within the window acquires the lock and runs the
// scan; subsequent calls within 30s see the existing lock and return 429.
//
// v9 — entitlement gate REMOVED. The first-connect scan can return 0
// detections because Plaid hasn't finished pulling transactions yet
// (the SYNC_UPDATES_AVAILABLE webhook arrives 10-60s after the initial
// bank connect, by which point the user has already seen an empty
// dashboard). New users need an unlock path to retry without paying.
// The 30s Redis cooldown still prevents abuse — at most one re-scan
// every 30s regardless of tier.
//
// Returns the scan_id so the client can subscribe to /api/plaid/scan/stream
// without waiting for the scan body to finish.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(_req: Request) {
  void _req;
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cooldownKey = cacheKey.rescanCooldown(user.id);
  const fresh = await tryAcquireLock(
    cooldownKey,
    Math.ceil(SCAN_BUDGET_MS.rescanCooldown / 1000)
  );
  if (!fresh) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Re-scan available every 30 seconds.",
      },
      { status: 429 }
    );
  }

  const result = await runScanForUser(user.id, "manual");

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    scan_id: result.scan_id,
    detected: result.detected,
    failedItems: result.failedItems,
    duration_ms: result.duration_ms,
  });
}
