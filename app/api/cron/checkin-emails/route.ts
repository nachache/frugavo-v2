import { NextResponse } from "next/server";
import { dispatchPendingCheckinEmails } from "@/lib/email/dispatch-checkins";

// GET/POST /api/cron/checkin-emails
//
// Trigger the 15-min checkin email dispatcher. Sends to every user
// who:
//   - connected > 15 min ago (their first_connect scan started)
//   - hasn't yet hit first_ready_at
//   - hasn't been checkin-emailed already
//
// Idempotent. Safe to run every minute, every 5 minutes, every hour.
//
// Auth: requires CRON_SECRET as either a Bearer header or ?token query
// param. Without it returns 401. (External cron services like
// cron-job.org or GitHub Actions pass the token.)
//
// To call manually (admin):
//   curl https://frugavo.com/api/cron/checkin-emails?token=YOUR_CRON_SECRET

export const runtime = "nodejs";
export const maxDuration = 30;

async function handle(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server" },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  const headerToken = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const provided = queryToken ?? headerToken;

  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dispatchPendingCheckinEmails();
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error("[cron/checkin-emails] failed", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
