import { resend } from "@/lib/email";

// First-ready transactional email — the "first magic moment."
//
// Fires exactly once per user, the moment the first scan transitions
// into ready_with_results or ready_but_empty. Idempotency lives on
// app_users.first_ready_email_sent_at; the caller (lib/ingestion-
// state.ts) only invokes us when the column is null.
//
// PRINCIPLE — calm financial intelligence, not lifecycle automation:
//   • Lead with observation, not status: "We analyzed your recurring
//     spending" beats "Your dashboard is ready."
//   • Quantified insight in the headline: N services, $X/mo.
//   • Optional concentration tagline: "Telecom is 45% of your spend."
//   • Single CTA, calm tone, no marketing copy.
//
// When the user's trial activation lands inside the same onboarding
// window as first-ready, the standalone "You're protected" billing
// email is suppressed and this email absorbs it via the
// `includeProtectionLine` flag. The result is one premium moment
// instead of two operational ones.

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "https://frugavo.com";

export type FirstReadyInsights = {
  // Confirmed sub count and monthly total — both required when
  // reachedState === "ready_with_results". For "ready_but_empty"
  // both are 0.
  subCount: number;
  monthlyTotalCents: number;
  // Optional concentration line — "Telecom is 45% of your spend" or
  // "Your spending is diversified across 5 categories." Computed
  // upstream from the dashboard payload's ConcentrationInsight.
  // Pass null to omit.
  insightLine: string | null;
};

export async function sendFirstReadyEmail(args: {
  email: string;
  reachedState: "ready_with_results" | "ready_but_empty";
  insights: FirstReadyInsights;
  // When true, append a single short paragraph acknowledging that
  // monitoring is now active. Used when this email is absorbing the
  // standalone trial_started "You're protected" message.
  includeProtectionLine?: boolean;
}): Promise<{ skipped: true } | { id: string }> {
  if (!resend) return { skipped: true };
  if (!args.email) return { skipped: true };

  const { reachedState, insights, includeProtectionLine } = args;

  // ─── Subject + headline ────────────────────────────────────────
  // Observation-led, not status-led.
  const subject =
    reachedState === "ready_with_results"
      ? "We analyzed your recurring spending"
      : "Your subscription analysis is ready";

  const headline =
    reachedState === "ready_with_results"
      ? "We analyzed your recurring spending."
      : "Your analysis is ready.";

  // ─── Lead insight ──────────────────────────────────────────────
  // For populated dashboards, lead with the quantified finding.
  // For empty dashboards, lead with the honest "clean account" line.
  const moneyFmt = `$${Math.round(insights.monthlyTotalCents / 100).toLocaleString("en-US")}`;
  const leadInsight =
    reachedState === "ready_with_results"
      ? insights.subCount === 1
        ? `We found <strong>1 recurring service</strong> totaling <strong>${moneyFmt}/mo</strong>.`
        : `We found <strong>${insights.subCount} recurring services</strong> totaling <strong>${moneyFmt}/mo</strong>.`
      : "Your bank finished sending us your transactions. We didn't find any recurring charges on this account — a clean result, not a failure.";

  // ─── Optional concentration / tone-setting follow-up ───────────
  const followUp =
    reachedState === "ready_with_results" && insights.insightLine
      ? insights.insightLine
      : null;

  // ─── Protection acknowledgment (merge line) ────────────────────
  // Short, calm, integrated. Avoids the "lifecycle automation" feel
  // of a separate "You're protected" email firing seconds apart.
  const protectionLine = includeProtectionLine
    ? "Monitoring is now active in the background — new charges, price hikes, and trial conversions will surface here as they happen."
    : null;

  // ─── CTA ───────────────────────────────────────────────────────
  const ctaUrl = `${APP_URL}/app`;
  const ctaLabel =
    reachedState === "ready_with_results"
      ? "View your analysis"
      : "Open Frugavo";

  // ─── HTML render ───────────────────────────────────────────────
  const followUpHtml = followUp
    ? `<p style="font-size:15px;line-height:1.65;color:#475569;margin:0 0 22px;">${escapeHtml(followUp)}</p>`
    : "";
  const protectionHtml = protectionLine
    ? `<p style="font-size:14px;line-height:1.65;color:#64748B;margin:24px 0 28px;padding:14px 16px;background:#F1F5F9;border-radius:10px;">${escapeHtml(protectionLine)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FAF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
  <div style="max-width:520px;margin:0 auto;padding:48px 24px;">
    <div style="font-size:13px;color:#047857;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">FRUGAVO</div>
    <h1 style="font-size:30px;line-height:1.15;letter-spacing:-0.02em;margin:18px 0 22px;font-weight:600;">${headline}</h1>
    <p style="font-size:16px;line-height:1.6;color:#0F172A;margin:0 0 ${followUp ? 18 : 28}px;">${leadInsight}</p>
    ${followUpHtml}
    ${protectionHtml}
    <a href="${ctaUrl}" style="display:inline-block;background:#0F172A;color:#FAFAFA;text-decoration:none;font-weight:500;font-size:14.5px;padding:13px 26px;border-radius:999px;">${ctaLabel} →</a>
    <p style="font-size:11.5px;line-height:1.6;color:#94A3B8;margin:56px 0 0;">
      We only send this once, right after your first analysis completes.
    </p>
  </div>
</body></html>`;

  // ─── Plain-text render ─────────────────────────────────────────
  const plainLead =
    reachedState === "ready_with_results"
      ? `We found ${insights.subCount} recurring service${insights.subCount === 1 ? "" : "s"} totaling ${moneyFmt}/mo.`
      : "Your bank finished sending us your transactions. We didn't find any recurring charges on this account — a clean result, not a failure.";
  const text = [
    headline,
    "",
    plainLead,
    followUp ? "" : null,
    followUp,
    protectionLine ? "" : null,
    protectionLine,
    "",
    `${ctaLabel}: ${ctaUrl}`,
    "",
    "— Frugavo",
  ]
    .filter((l) => l !== null)
    .join("\n");

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
