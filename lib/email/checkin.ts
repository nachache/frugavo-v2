import { resend } from "@/lib/email";

// 15-min checkin email.
//
// Sent ONCE per user, ~15 min after their first scan started, if
// they haven't reached first_ready_at yet. Typical recipient: a
// Plaid Classic user (Wealthsimple, Scotiabank, credit union)
// whose bank is still inside Plaid's queue.
//
// Purpose: reassure them the wait is normal + invite them to close
// the tab + promise the real "your dashboard is ready" email when
// the data lands. Idempotent via app_users.checkin_email_sent_at.

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "https://frugavo.com";

export async function sendCheckinEmail(args: {
  email: string;
  bankName?: string | null;
}): Promise<{ skipped: true } | { id: string }> {
  if (!resend || !args.email) return { skipped: true };

  const bank = args.bankName?.trim() || "your bank";

  const subject = "Your scan is taking longer than usual";
  const headline = "Hang tight — your bank is slow.";
  const body = `${bank} uses Plaid's older integration, which can take 15–30 minutes (sometimes longer) to release your full transaction history on the first connect. There's nothing you need to do — we'll keep checking in the background and email you the moment your dashboard is ready.`;

  const ctaUrl = `${APP_URL}/app`;
  const ctaLabel = "Check status";

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FAF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:13px;color:#047857;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">FRUGAVO</div>
    <h1 style="font-size:28px;line-height:1.15;letter-spacing:-0.02em;margin:14px 0 18px;">${headline}</h1>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 18px;">${escapeHtml(body)}</p>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 28px;">No need to keep the tab open — close it if you want, we&apos;ll email when ready.</p>
    <a href="${ctaUrl}" style="display:inline-block;background:#0F172A;color:#FAFAFA;text-decoration:none;font-weight:500;font-size:14px;padding:12px 22px;border-radius:999px;">${ctaLabel}</a>
    <p style="font-size:11.5px;line-height:1.6;color:#94A3B8;margin:48px 0 0;">
      You&apos;re getting this because you just connected ${escapeHtml(bank)}. We only send this checkin once.
    </p>
  </div>
</body></html>`;

  const text = `${headline}

${body}

No need to keep the tab open — close it if you want, we'll email when ready.

${ctaLabel}: ${ctaUrl}

— Frugavo`;

  const fromEmail =
    process.env.RESEND_FROM_EMAIL ??
    process.env.FROM_EMAIL ??
    "Frugavo <hello@frugavo.com>";

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: args.email,
    subject,
    html,
    text,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "resend_failed");
  }
  return { id: data.id };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
