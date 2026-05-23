// Email templates — HTML + plain-text fallback for every alert type.
//
// Voice: calm, protective, factual. We are not a marketing email; we
// are a watchtower. Headlines describe what we caught, body explains
// what it means, single CTA links back into the app for the user to
// decide.
//
// No external CSS — everything inline so it renders the same in
// Gmail, Outlook, Apple Mail, and the dozen weird webmail clients
// nobody supports cleanly.
//
// Templates take a small ViewModel — we don't pass the raw Alert
// row because the dispatcher needs to format currency, build URLs,
// and resolve merchant logos before rendering.

import type { Alert } from "@/lib/monitoring/types";

type CommonProps = {
  appUrl: string;
  unsubscribeUrl: string;        // for List-Unsubscribe header + footer link
  managePreferencesUrl: string;  // settings page
};

type AlertEmailProps = CommonProps & {
  alert: Alert;
};

type DigestEmailProps = CommonProps & {
  alerts: Alert[];
  digestDate: string;            // e.g. "May 23, 2026"
};

// ─── Shared chrome ─────────────────────────────────────────────────

const COLOR_INK = "#0a0a0a";
const COLOR_INK_BODY = "#404040";
const COLOR_INK_MUTED = "#737373";
const COLOR_BG = "#fafafa";
const COLOR_SURFACE = "#ffffff";
const COLOR_BORDER = "#e5e5e5";
const COLOR_BRAND = "#059669";
const COLOR_ACCENT = "#f59e0b";
const COLOR_DANGER = "#dc2626";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function severityColor(sev: string): string {
  if (sev === "urgent") return COLOR_DANGER;
  if (sev === "notice") return COLOR_ACCENT;
  return COLOR_BRAND;
}

function wrapHtml(opts: {
  preview: string;
  bodyHtml: string;
  unsubscribeUrl: string;
  managePreferencesUrl: string;
  appUrl: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Frugavo</title>
</head>
<body style="margin:0;padding:0;background:${COLOR_BG};color:${COLOR_INK_BODY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(opts.preview)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLOR_BG};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background:${COLOR_SURFACE};border:1px solid ${COLOR_BORDER};border-radius:16px;overflow:hidden;">
      <tr><td style="padding:24px 28px 8px 28px;">
        <a href="${esc(opts.appUrl)}" style="text-decoration:none;color:${COLOR_INK};">
          <span style="display:inline-block;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:${COLOR_INK};">Frugavo</span>
          <span style="display:inline-block;margin-left:8px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:${COLOR_INK_MUTED};">Peace of Mind</span>
        </a>
      </td></tr>
      <tr><td style="padding:8px 28px 28px 28px;">
        ${opts.bodyHtml}
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;margin-top:16px;">
      <tr><td align="center" style="padding:12px;font-size:11px;color:${COLOR_INK_MUTED};line-height:1.6;">
        You're getting this because you connected your bank to Frugavo and asked us to keep watch.<br/>
        <a href="${esc(opts.managePreferencesUrl)}" style="color:${COLOR_INK_MUTED};text-decoration:underline;">Manage alert preferences</a>
        &nbsp;·&nbsp;
        <a href="${esc(opts.unsubscribeUrl)}" style="color:${COLOR_INK_MUTED};text-decoration:underline;">Unsubscribe from all</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── Per-alert renderers ───────────────────────────────────────────

function renderAlertBlock(alert: Alert, appUrl: string): string {
  const headline =
    (alert.details?.headline as string | undefined) ?? alert.alert_type;
  const subLine = (alert.details?.sub_line as string | undefined) ?? "";
  const dotColor = severityColor(alert.severity);
  const merchant = alert.merchant_name ?? "";
  const ctaHref = alert.subscription_id
    ? `${appUrl.replace(/\/$/, "")}/app/subscriptions/${alert.subscription_id}`
    : `${appUrl.replace(/\/$/, "")}/app/alerts`;

  return `
<div style="border:1px solid ${COLOR_BORDER};border-radius:12px;padding:16px;margin:12px 0;">
  <div style="display:flex;align-items:center;gap:8px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:${COLOR_INK_MUTED};margin-bottom:6px;">
    <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${dotColor};vertical-align:middle;"></span>
    <span style="vertical-align:middle;">${esc(alert.alert_type.replace(/_/g, " "))}</span>
  </div>
  <div style="font-size:16px;font-weight:600;color:${COLOR_INK};line-height:1.35;">${esc(headline)}</div>
  ${subLine ? `<div style="margin-top:6px;font-size:14px;color:${COLOR_INK_BODY};line-height:1.5;">${esc(subLine)}</div>` : ""}
  ${merchant ? `<div style="margin-top:8px;font-size:12px;color:${COLOR_INK_MUTED};">${esc(merchant)}</div>` : ""}
  <div style="margin-top:14px;">
    <a href="${esc(ctaHref)}" style="display:inline-block;background:${COLOR_INK};color:${COLOR_SURFACE};text-decoration:none;font-size:13px;font-weight:500;padding:8px 14px;border-radius:9999px;">Review in Frugavo →</a>
  </div>
</div>`;
}

// ─── Urgent single-alert email ─────────────────────────────────────

export function renderUrgentEmail(props: AlertEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const a = props.alert;
  const headline =
    (a.details?.headline as string | undefined) ?? a.alert_type;
  const subject = `Frugavo caught this: ${headline}`;

  const intro =
    a.alert_type === "trial_converting"
      ? "Your free trial is about to turn into a paid subscription. We wanted you to know before the charge posts."
      : a.alert_type === "price_increase"
        ? "A subscription you use just got more expensive. Here are the numbers."
        : a.alert_type === "high_charge_amount"
          ? "We saw a charge that doesn't match your usual pattern for this merchant."
          : a.alert_type === "duplicate_subscription"
            ? "You appear to be paying twice for the same service."
            : "We noticed something on your accounts.";

  const body = `
<p style="font-size:14px;color:${COLOR_INK_BODY};line-height:1.6;margin:16px 0 0 0;">${esc(intro)}</p>
${renderAlertBlock(a, props.appUrl)}
<p style="font-size:12px;color:${COLOR_INK_MUTED};line-height:1.6;margin:12px 0 0 0;">
We're watching quietly in the background. If this is expected, dismiss the alert and we'll stop bringing it up.
</p>`;

  const html = wrapHtml({
    preview: headline,
    bodyHtml: body,
    unsubscribeUrl: props.unsubscribeUrl,
    managePreferencesUrl: props.managePreferencesUrl,
    appUrl: props.appUrl,
  });

  const text = [
    `Frugavo caught this:`,
    headline,
    "",
    intro,
    "",
    `Open in Frugavo: ${props.appUrl}/app/alerts`,
    "",
    `Manage preferences: ${props.managePreferencesUrl}`,
    `Unsubscribe: ${props.unsubscribeUrl}`,
  ].join("\n");

  return { subject, html, text };
}

// ─── Daily digest ──────────────────────────────────────────────────

export function renderDigestEmail(props: DigestEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const count = props.alerts.length;
  const subject =
    count === 1
      ? `Frugavo: 1 thing to look at`
      : `Frugavo: ${count} things we caught today`;

  const intro =
    count === 1
      ? "Here's what we noticed on your accounts since yesterday."
      : `Here are the ${count} things we noticed on your accounts since yesterday.`;

  const blocks = props.alerts
    .map((a) => renderAlertBlock(a, props.appUrl))
    .join("\n");

  const body = `
<div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:${COLOR_INK_MUTED};margin-top:8px;">Your daily watch</div>
<div style="font-size:22px;font-weight:700;color:${COLOR_INK};margin-top:6px;letter-spacing:-0.01em;">${esc(props.digestDate)}</div>
<p style="font-size:14px;color:${COLOR_INK_BODY};line-height:1.6;margin:12px 0 0 0;">${esc(intro)}</p>
${blocks}
<p style="font-size:12px;color:${COLOR_INK_MUTED};line-height:1.6;margin:16px 0 0 0;">
Nothing here that needs you? Close this email — we'll be back tomorrow only if there's something new.
</p>`;

  const html = wrapHtml({
    preview:
      count === 1
        ? "1 thing to look at"
        : `${count} things we caught today`,
    bodyHtml: body,
    unsubscribeUrl: props.unsubscribeUrl,
    managePreferencesUrl: props.managePreferencesUrl,
    appUrl: props.appUrl,
  });

  const text = [
    subject,
    "",
    intro,
    "",
    ...props.alerts.map((a) => {
      const h =
        (a.details?.headline as string | undefined) ?? a.alert_type;
      const s = (a.details?.sub_line as string | undefined) ?? "";
      return `• ${h}${s ? ` — ${s}` : ""}`;
    }),
    "",
    `See all: ${props.appUrl}/app/alerts`,
    `Manage preferences: ${props.managePreferencesUrl}`,
    `Unsubscribe: ${props.unsubscribeUrl}`,
  ].join("\n");

  return { subject, html, text };
}

// Helper for currency in tests / direct usage
export { fmtUsd };
