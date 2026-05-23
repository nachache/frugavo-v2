import { NextResponse } from "next/server";
import { runReconciliation } from "@/lib/billing/reconciler";

// GET /api/cron/reconcile-billing
//
// Daily Netlify scheduled function. Lists Stripe subscriptions in
// active/trialing/past_due/unpaid statuses, compares to our local
// projection, replays any mismatched customers, and returns the
// surviving (unresolved) divergences.
//
// Authenticated with CRON_SECRET in the Authorization header.

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — generous for fanout

export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReconciliation();
  return NextResponse.json(result);
}
