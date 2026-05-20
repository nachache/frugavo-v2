import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { runScanForUser } from "@/lib/scan";

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

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
