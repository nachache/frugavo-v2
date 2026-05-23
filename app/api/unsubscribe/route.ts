import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyUnsubscribeSignature } from "@/lib/notifications/unsubscribe";
import { savePreferences } from "@/lib/notifications/preferences";

// GET /api/unsubscribe?u=USER&t=TYPE&s=SIG
// POST same params (RFC 8058 List-Unsubscribe one-click)
//
// HMAC-signed, no login required. Per-type unsubscribe when t is a
// specific alert_type; "all" sets global_unsubscribed_at and turns
// off email_enabled.
//
// Always responds with a small HTML page so the user gets feedback
// in their browser. Gmail's one-click POST treats any 2xx as success.

export const runtime = "nodejs";

async function process(req: Request): Promise<NextResponse | Response> {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u");
  const alertType = url.searchParams.get("t");
  const sig = url.searchParams.get("s");

  if (!userId || !alertType || !sig) {
    return htmlResponse("Missing parameters.", 400);
  }
  if (!verifyUnsubscribeSignature(userId, alertType, sig)) {
    return htmlResponse("Invalid or expired unsubscribe link.", 400);
  }
  if (!supabaseAdmin) {
    return htmlResponse("Service temporarily unavailable.", 500);
  }

  if (alertType === "all") {
    await savePreferences(userId, {
      email_enabled: false,
      global_unsubscribed_at: new Date().toISOString(),
    });
    return htmlResponse(
      "You're unsubscribed from all Frugavo emails. We'll still keep watch over your accounts — you can check the dashboard anytime."
    );
  }

  // Per-type opt-out — flip just that key in enabled_types.
  await savePreferences(userId, {
    enabled_types: { [alertType]: false },
  });
  return htmlResponse(
    `You'll no longer receive ${alertType.replace(/_/g, " ")} emails. Other Frugavo alerts will keep coming.`
  );
}

export async function GET(req: Request) {
  return process(req);
}

export async function POST(req: Request) {
  return process(req);
}

function htmlResponse(message: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Frugavo — preferences updated</title>
<style>
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fafafa; color: #0a0a0a; }
.wrap { max-width: 480px; margin: 60px auto; padding: 0 16px; }
.card { background: white; border: 1px solid #e5e5e5; border-radius: 16px; padding: 28px; }
h1 { font-size: 20px; margin: 0 0 8px 0; }
p { font-size: 15px; line-height: 1.5; color: #404040; margin: 0; }
a { color: #059669; text-decoration: none; font-weight: 500; }
.brand { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #737373; margin-bottom: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="brand">Frugavo</div>
    <h1>Preferences updated</h1>
    <p>${message}</p>
    <p style="margin-top:16px;"><a href="https://frugavo.com/app/settings/notifications">Manage all preferences →</a></p>
  </div>
</div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
