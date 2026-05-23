import { NextResponse } from "next/server";
import { runDunningSweep } from "@/lib/billing/scheduled-dunning";

// GET /api/cron/billing-dunning
//
// Daily Netlify scheduled function. Sends time-driven billing
// reminders (T+6 trial, T+72h retry, T+10/T+18 grace warnings).
//
// Event-driven emails (trial_started, payment_declined,
// protection_paused, protection_ended) come from the projector
// side-effect path — not from this cron.
//
// Auth via CRON_SECRET in the Authorization header, same pattern as
// the existing daily-monitoring cron.

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — generous; usually finishes in seconds

export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDunningSweep();
  return NextResponse.json({ ok: true, ...result });
}
