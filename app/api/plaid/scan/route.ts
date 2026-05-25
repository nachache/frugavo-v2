import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { runScanForUser } from "@/lib/scan";
import { cacheKey, checkRateLimit } from "@/lib/cache";

// POST /api/plaid/scan
//
// Manually triggers a Plaid recurring-transactions scan for the current
// user. Returns a summary of how many subscriptions were detected and
// how many connected Items failed (Plaid errors, expired tokens, etc.).
//
// In v1 we trigger this:
//   (a) automatically on the first /app visit after a successful Plaid
//       connect (server-side, before render), and
//   (b) manually via a "Re-scan" button in the dashboard (this endpoint).
//
// Rate limit: 5 scans per user per 5 minutes. Sandbox calls are free,
// but production calls bill per /transactions/sync hit. A bug or rage-
// click loop could otherwise burn through Plaid quota fast. The /rescan
// endpoint has its own 30s cooldown; this one is the auto-on-connect
// path so the limit is looser but still bounded.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(
    cacheKey.scanRateLimit(user.id),
    5, // max scans per window
    300 // window = 5 minutes
  );
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retry_after_seconds: rl.retry_after_seconds,
        message: "Too many scans. Try again in a few minutes.",
      },
      { status: 429 }
    );
  }

  const result = await runScanForUser(user.id);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    detected: result.detected,
    failedItems: result.failedItems,
  });
}
