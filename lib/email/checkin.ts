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

export async function sendCheckinEmail(args: {
  email: string;
  // bankName is no longer used in the body — the new calm copy is
  // bank-agnostic — but we keep accepting it so existing callers
  // (dispatch-checkins.ts) don't need to be touched.
  bankName?: string | null;
}): Promise<{ skipped: true } | { id: string }> {
  void args.bankName;
  if (!resend || !args.email) return { skipped: true };

  // Calm, reassuring, intelligent — no ticketing-system tone, no
  // "support automation" tells, no apology, no SLA framing. The user
  // is waiting on data they care about; we acknowledge that quietly
  // and promise the meaningful follow-up.

  const subject = "Still analyzing your recurring spending";
  const headline = "Some banks take a little longer.";
  const body =
    "We're still processing your recurring spending patterns. There's nothing for you to do — we'll let you know the moment your subscription analysis is complete.";

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FAF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
  <div style="max-width:520px;margin:0 auto;padding:48px 24px;">
    <div style="font-size:13px;color:#047857;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">FRUGAVO</div>
    <h1 style="font-size:28px;line-height:1.15;letter-spacing:-0.02em;margin:18px 0 22px;font-weight:600;">${headline}</h1>
    <p style="font-size:15.5px;line-height:1.65;color:#334155;margin:0 0 32px;">${escapeHtml(body)}</p>
    <p style="font-size:12px;line-height:1.6;color:#94A3B8;margin:56px 0 0;">
      We only send this once, when a bank takes longer than usual on the first analysis.
    </p>
  </div>
</body></html>`;

  const text = `${headline}

${body}

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
