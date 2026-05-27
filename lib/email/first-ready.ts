import { resend } from "@/lib/email";

// First-ready transactional email.
//
// Fires exactly once per user — the moment computeIngestionState
// transitions from preparing/syncing/analyzing → ready_with_results
// or ready_but_empty. Idempotency is enforced by
// app_users.first_ready_email_sent_at; the caller in lib/ingestion-
// state.ts only invokes this when the column is null.
//
// Two flavors:
//   ready_with_results — "Your dashboard is ready" with a brief CTA
//   ready_but_empty    — "We finished scanning, nothing recurring
//                        showed up" so users who happened to have a
//                        very clean account don't think the product
//                        broke.
//
// Both link directly to /app. No marketing copy, no calls to share,
// no extra content. The user came back because the data they were
// waiting for is finally there.

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "https://frugavo.com";

export async function sendFirstReadyEmail(args: {
  email: string;
  reachedState: "ready_with_results" | "ready_but_empty";
}): Promise<{ skipped: true } | { id: string }> {
  if (!resend) return { skipped: true };
  if (!args.email) return { skipped: true };

  const subject =
    args.reachedState === "ready_with_results"
      ? "Your Frugavo dashboard is ready"
      : "We finished scanning your account";

  const headline =
    args.reachedState === "ready_with_results"
      ? "Your dashboard is ready."
      : "Your scan is complete.";

  const body =
    args.reachedState === "ready_with_results"
      ? "Your bank finished sending us your transactions and we've identified your recurring charges. Open the dashboard whenever you're ready."
      : "Your bank finished sending us your transactions. We didn't find any recurring charges on this account — that's a clean result, not a failure. If you connect another account later, we'll re-scan automatically.";

  const ctaUrl = `${APP_URL}/app`;
  const ctaLabel =
    args.reachedState === "ready_with_results"
      ? "Open my dashboard"
      : "Open Frugavo";

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FAF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:13px;color:#047857;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">FRUGAVO</div>
    <h1 style="font-size:30px;line-height:1.15;letter-spacing:-0.02em;margin:14px 0 18px;">${headline}</h1>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 28px;">${escapeHtml(body)}</p>
    <a href="${ctaUrl}" style="display:inline-block;background:#0F172A;color:#FAFAFA;text-decoration:none;font-weight:500;font-size:14px;padding:12px 22px;border-radius:999px;">${ctaLabel}</a>
    <p style="font-size:11.5px;line-height:1.6;color:#94A3B8;margin:48px 0 0;">
      You're getting this because you connected a bank to Frugavo. We only send this once, right after your first scan finishes.
    </p>
  </div>
</body></html>`;

  const text = `${headline}

${body}

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
    // eslint-disable-next-line no-console
    console.error("[email/first-ready] send failed", error);
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
