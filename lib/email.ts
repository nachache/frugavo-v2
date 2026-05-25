import { Resend } from "resend";

// Transactional email via Resend. The client is null-safe so the build
// doesn't fail when the API key is missing (e.g. preview deploys).
// Production must set RESEND_API_KEY and RESEND_FROM_EMAIL.
//
// FROM_EMAIL is a legacy alias kept for back-compat. New code paths
// (lib/notifications/send-email.ts) only read RESEND_FROM_EMAIL.
// Precedence: RESEND_FROM_EMAIL > FROM_EMAIL > hardcoded fallback.

const apiKey = process.env.RESEND_API_KEY;
const fromEmail =
  process.env.RESEND_FROM_EMAIL ??
  process.env.FROM_EMAIL ??
  "Frugavo <hello@frugavo.com>";

export const resend: Resend | null = apiKey ? new Resend(apiKey) : null;

if (!resend) {
  // eslint-disable-next-line no-console
  console.warn(
    "[email] RESEND_API_KEY missing — outbound email disabled"
  );
}

export type DigestPayload = {
  to: string;
  firstName?: string;
  monthlyCents: number;
  pendingCount: number;
  confirmedCount: number;
  failedCount: number;
  savedAnnualCents: number;
  reviewCount: number;
};

// Plain-text + HTML version of the biweekly digest. We keep the design
// minimal — single column, brand color, lots of whitespace. The HTML is
// intentionally inline-styled so it renders in every client.
export async function sendBiweeklyDigest(payload: DigestPayload) {
  if (!resend) return { skipped: true } as const;

  const dollars = (cents: number): string =>
    `$${(cents / 100).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`;

  const subject = payload.confirmedCount
    ? `You just saved ${dollars(payload.savedAnnualCents)}/yr`
    : payload.reviewCount
    ? `${payload.reviewCount} subscription${payload.reviewCount === 1 ? "" : "s"} worth a look`
    : `Your Frugavo check-in`;

  const greeting = payload.firstName ? `Hi ${payload.firstName},` : "Hi,";

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FAF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:14px;color:#047857;font-weight:600;letter-spacing:0.05em;">FRUGAVO</div>
    <h1 style="font-size:28px;line-height:1.15;letter-spacing:-0.02em;margin:12px 0 16px;">${subject}</h1>
    <p style="font-size:15px;line-height:1.6;color:#404040;">${greeting}</p>
    <p style="font-size:15px;line-height:1.6;color:#404040;">
      Here's where your subscriptions stand right now.
    </p>

    <div style="margin:24px 0;padding:20px;background:#ECFDF5;border-radius:16px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.14em;color:#065F46;font-weight:600;">Currently paying</div>
      <div style="font-size:32px;font-weight:700;color:#047857;margin-top:4px;">${dollars(payload.monthlyCents)}<span style="font-size:14px;color:#065F46;font-weight:500;">/mo</span></div>
    </div>

    ${
      payload.confirmedCount
        ? `<p style="font-size:15px;line-height:1.6;color:#404040;">
        ✓ ${payload.confirmedCount} cancellation${payload.confirmedCount === 1 ? "" : "s"} confirmed — the bill didn't come back. That's <strong>${dollars(payload.savedAnnualCents)}/yr</strong> saved.
      </p>`
        : ""
    }
    ${
      payload.failedCount
        ? `<p style="font-size:15px;line-height:1.6;color:#404040;">
        ⚠ ${payload.failedCount} cancellation${payload.failedCount === 1 ? "" : "s"} didn't take — the charge came back. <a href="https://frugavo.com/app" style="color:#047857;">Open Frugavo</a> to retry.
      </p>`
        : ""
    }
    ${
      payload.pendingCount
        ? `<p style="font-size:15px;line-height:1.6;color:#404040;">
        ${payload.pendingCount} cancellation${payload.pendingCount === 1 ? "" : "s"} still pending — we're watching the next bill.
      </p>`
        : ""
    }
    ${
      payload.reviewCount
        ? `<p style="font-size:15px;line-height:1.6;color:#404040;">
        ${payload.reviewCount} subscription${payload.reviewCount === 1 ? "" : "s"} look like good candidates to cancel.
      </p>`
        : ""
    }

    <div style="margin:28px 0;">
      <a href="https://frugavo.com/app" style="display:inline-block;background:#0A0A0A;color:white;font-size:14px;font-weight:500;padding:12px 22px;border-radius:999px;text-decoration:none;">
        Open my dashboard
      </a>
    </div>

    <p style="font-size:12px;color:#737373;line-height:1.6;margin-top:36px;">
      You're getting this because you have an active Frugavo account. Want fewer of these? <a href="https://frugavo.com/app/settings" style="color:#737373;">Manage preferences</a>.
    </p>
  </div>
</body></html>`;

  const text = [
    subject,
    "",
    greeting,
    "",
    `Currently paying: ${dollars(payload.monthlyCents)}/month.`,
    payload.confirmedCount
      ? `${payload.confirmedCount} cancellation${payload.confirmedCount === 1 ? "" : "s"} confirmed — ${dollars(payload.savedAnnualCents)}/yr saved.`
      : "",
    payload.failedCount
      ? `${payload.failedCount} cancellation${payload.failedCount === 1 ? "" : "s"} didn't stick. Open Frugavo to retry.`
      : "",
    payload.pendingCount
      ? `${payload.pendingCount} cancellation${payload.pendingCount === 1 ? "" : "s"} pending.`
      : "",
    payload.reviewCount
      ? `${payload.reviewCount} subscription${payload.reviewCount === 1 ? "" : "s"} worth reviewing.`
      : "",
    "",
    "Dashboard: https://frugavo.com/app",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await resend.emails.send({
      from: fromEmail,
      to: payload.to,
      subject,
      html,
      text,
    });
    return { skipped: false } as const;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[email] digest send failed", e);
    return { skipped: false, error: String(e) } as const;
  }
}
