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
// Returns the scan_id so the client can subscribe to /api/plaid/scan/stream
// without waiting for the scan body to finish.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(_req?: Request) {
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
