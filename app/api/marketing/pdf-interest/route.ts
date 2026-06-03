import { NextResponse, type NextRequest } from "next/server";

// POST /api/marketing/pdf-interest
//
// Validation endpoint for the "Don't want to connect a bank? Upload a
// statement instead (coming soon)" CTA on the landing page hero.
//
// Captures email-interested-in-PDF and fires a Slack ping so we can
// count signal volume without provisioning a new Supabase table.
// Reuses SLACK_OPS_WEBHOOK_URL (same hook used for new-signup pings)
// with a different :mailbox: emoji + tag so we can filter visually.
//
// No persistence beyond Slack. If volume grows past ~50 interested
// users, we'll back this with a real Supabase table; for now Slack
// is the cheapest possible validation surface.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // Fire-and-forget to Slack. Failure here is silent — we still 200
  // the user so the UI shows success. We'd rather collect the email
  // intent than lose it because Slack flaked.
  const slackUrl = (process.env.SLACK_OPS_WEBHOOK_URL ?? "").trim();
  if (slackUrl && slackUrl.startsWith("https://hooks.slack.com/")) {
    try {
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text:
            `:mailbox_with_mail: *PDF-upload interest captured*\n` +
            `*Email:* ${email}\n` +
            `*Source:* hero CTA — "Don't want to connect a bank?"\n` +
            `*Action:* count, don't reply (no product to send yet)`,
        }),
      });
    } catch {
      /* swallow — see file header */
    }
  }

  return NextResponse.json({ ok: true });
}
