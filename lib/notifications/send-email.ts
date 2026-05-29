// Resend email transport.
//
// Required env vars:
//   - RESEND_API_KEY        — from https://resend.com/api-keys
//   - RESEND_FROM_EMAIL     — verified sender, e.g.
//                             "Frugavo <alerts@frugavo.com>"
//   - APP_URL               — used in email links + unsubscribe URLs
//
// Optional env vars:
//   - UNSUBSCRIBE_HMAC_SECRET — separate secret for unsub tokens;
//                               falls back to CRON_SECRET if unset.
//
// We don't depend on the official `resend` package — a single fetch
// keeps the dependency footprint tiny and avoids version churn.
// Resend's HTTPS API is dead-simple.
//
// All sends are best-effort: a Resend outage must not break the
// monitoring scan. Callers should `try { await sendEmail(...) }
// catch (e) { record('failed', e.message) }` rather than throw.

export type SendEmailInput = {
  // Resend accepts either a single address or an array of up to 50.
  // Exposing both so ops paths (signup pings, alerts) can fan out
  // to multiple inboxes in a single API call.
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  // RFC 8058 one-click unsubscribe headers. When present, Gmail
  // shows a native "Unsubscribe" link next to the sender name.
  listUnsubscribeUrl?: string;
  tags?: Record<string, string>;
};

export type SendEmailResult = {
  ok: boolean;
  provider_id?: string;
  error?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: "Resend not configured" };
  }

  const body: Record<string, unknown> = {
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  };
  if (input.text) body.text = input.text;

  const headers: Record<string, string> = {};
  if (input.listUnsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${input.listUnsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  if (Object.keys(headers).length > 0) body.headers = headers;

  if (input.tags) {
    body.tags = Object.entries(input.tags).map(([name, value]) => ({
      name,
      value,
    }));
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `resend_http_${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const j = (await res.json()) as { id?: string };
    return { ok: true, provider_id: j.id ?? undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
