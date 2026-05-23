// Billing emails: render + send + log dispatch, idempotent.
//
// Eight templates wired to the projector (event-driven) and the
// dunning cron (time-driven). Each send is dedup'd via
// billing_email_dispatches.(clerk_user_id, email_type, dedup_key).
// Replaying a webhook never sends a second copy.
//
// Voice mirrors lib/notifications/templates.ts: calm, protective,
// factual. Copy framing per build doc: "protection paused", never
// "subscription cancelled."
//
// All sends are best-effort. Resend outage MUST NOT break webhook
// processing — callers wrap in try/catch already.

import { sendEmail } from "@/lib/notifications/send-email";
import { supabaseAdmin } from "@/lib/supabase";
import { appUrl } from "@/lib/billing/urls";

export type BillingEmailType =
  | "trial_started"
  | "trial_converts_t6"
  | "payment_declined"
  | "payment_retry_t72"
  | "grace_t10"
  | "grace_t18"
  | "protection_paused"
  | "protection_ended";

export type SendBillingEmailArgs = {
  clerkUserId: string;
  emailType: BillingEmailType;
  dedupKey: string;
  to: string;
  // Variables consumed by individual templates.
  data?: Record<string, string | number>;
};

// Public entry point. Returns true if sent (or already sent), false
// if skipped due to dispatch-table conflict.
export async function sendBillingEmail(
  args: SendBillingEmailArgs
): Promise<boolean> {
  if (!supabaseAdmin) return false;

  // Idempotency check + reservation in one shot. Insert with
  // ON CONFLICT DO NOTHING — if a row exists we don't send again.
  const { data: reservation, error: reserveErr } = await supabaseAdmin
    .from("billing_email_dispatches")
    .insert({
      clerk_user_id: args.clerkUserId,
      email_type: args.emailType,
      dedup_key: args.dedupKey,
      status: "sent", // optimistic; flip to failed below if send errors
    })
    .select("id")
    .maybeSingle();

  if (reserveErr) {
    if (isUniqueViolation(reserveErr)) {
      // Already dispatched — skip silently.
      return true;
    }
    // eslint-disable-next-line no-console
    console.error("[billing/emails] reservation failed", reserveErr);
    return false;
  }
  if (!reservation) {
    // Insert returned no row — conflict, treat as already sent.
    return true;
  }

  // Render + send.
  const { subject, html, text } = renderTemplate(args.emailType, args.data ?? {});
  const result = await sendEmail({
    to: args.to,
    subject,
    html,
    text,
    tags: {
      kind: "billing",
      type: args.emailType,
    },
  });

  if (!result.ok) {
    // Flip the dispatch row to failed so the daily cron can retry.
    await supabaseAdmin
      .from("billing_email_dispatches")
      .update({ status: "failed", error: result.error ?? "send_failed" })
      .eq("id", reservation.id);
    // eslint-disable-next-line no-console
    console.error("[billing/emails] send failed", args.emailType, result.error);
    return false;
  }

  await supabaseAdmin
    .from("billing_email_dispatches")
    .update({ resend_message_id: result.provider_id ?? null })
    .eq("id", reservation.id);

  return true;
}

function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  if (err.code === "23505") return true;
  if (err.message && /duplicate key value violates unique/i.test(err.message)) {
    return true;
  }
  return false;
}

// ─── Templates ────────────────────────────────────────────────────

type Rendered = { subject: string; html: string; text: string };

function renderTemplate(
  type: BillingEmailType,
  data: Record<string, string | number>
): Rendered {
  switch (type) {
    case "trial_started":
      return tplTrialStarted(data);
    case "trial_converts_t6":
      return tplTrialConvertsT6(data);
    case "payment_declined":
      return tplPaymentDeclined(data);
    case "payment_retry_t72":
      return tplPaymentRetryT72(data);
    case "grace_t10":
      return tplGraceT10(data);
    case "grace_t18":
      return tplGraceT18(data);
    case "protection_paused":
      return tplProtectionPaused(data);
    case "protection_ended":
      return tplProtectionEnded(data);
  }
}

// Shared chrome — inline styles only so every webmail renders it.
const COLOR_INK = "#0a0a0a";
const COLOR_INK_BODY = "#404040";
const COLOR_INK_MUTED = "#737373";
const COLOR_SURFACE = "#ffffff";
const COLOR_BORDER = "#e5e5e5";
const COLOR_BRAND = "#059669";
const COLOR_DANGER = "#dc2626";

function shell(opts: {
  preheader: string;
  body: string;
}): string {
  const base = appUrl().replace(/\/$/, "");
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:${COLOR_INK};">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:${COLOR_SURFACE};border:1px solid ${COLOR_BORDER};border-radius:16px;">
    <tr><td style="padding:28px 32px 8px 32px;">
      <a href="${base}/app" style="text-decoration:none;color:${COLOR_INK};font-weight:600;font-size:18px;letter-spacing:-0.01em;">Frugavo</a>
    </td></tr>
    <tr><td style="padding:16px 32px 28px 32px;">${opts.body}</td></tr>
    <tr><td style="padding:0 32px 28px 32px;">
      <div style="border-top:1px solid ${COLOR_BORDER};margin-top:8px;padding-top:16px;font-size:12px;color:${COLOR_INK_MUTED};line-height:1.6;">
        You're receiving this because you have an active Frugavo protection.<br>
        <a href="${base}/app/settings/notifications" style="color:${COLOR_INK_MUTED};text-decoration:underline;">Reduce email frequency</a>
        &nbsp;·&nbsp;
        <a href="${base}/app/settings" style="color:${COLOR_INK_MUTED};text-decoration:underline;">Manage protection</a>
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cta(href: string, label: string, color = COLOR_BRAND): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px;">${esc(label)}</a>`;
}

function h1(text: string): string {
  return `<h1 style="font-size:24px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${COLOR_INK};margin:0 0 12px 0;">${esc(text)}</h1>`;
}

function p(text: string): string {
  return `<p style="font-size:15px;line-height:1.55;color:${COLOR_INK_BODY};margin:0 0 14px 0;">${text}</p>`;
}

// ─── Individual templates ────────────────────────────────────────

function tplTrialStarted(_data: Record<string, string | number>): Rendered {
  const base = appUrl().replace(/\/$/, "");
  const subject = "You're protected.";
  const body = `
    ${h1("You're protected.")}
    ${p("Frugavo is now watching your accounts. The first time we catch something — a new charge, a price hike, a trial about to convert — you'll know.")}
    ${p("Your 7-day trial runs free. After that it's $14.99/month. Cancel anytime from your dashboard, no questions.")}
    <div style="margin:18px 0 6px 0;">${cta(`${base}/app`, "Open dashboard")}</div>
  `;
  const text = `You're protected.

Frugavo is now watching your accounts. The first time we catch something — a new charge, a price hike, a trial about to convert — you'll know.

Your 7-day trial runs free. After that it's $14.99/month. Cancel anytime from your dashboard.

${base}/app`;
  return { subject, html: shell({ preheader: "Monitoring is now active on your account.", body }), text };
}

function tplTrialConvertsT6(_data: Record<string, string | number>): Rendered {
  const base = appUrl().replace(/\/$/, "");
  const subject = "Your trial converts tomorrow.";
  const body = `
    ${h1("Your trial converts tomorrow.")}
    ${p("Frugavo's been watching for 6 days. Tomorrow your trial ends and your card will be charged <strong>$14.99</strong> to continue monitoring.")}
    ${p("Nothing to do — we'll just keep watching. If you'd rather not, cancel from your settings before tomorrow.")}
    <div style="margin:18px 0 6px 0;">${cta(`${base}/app/settings`, "Manage protection")}</div>
  `;
  const text = `Your trial converts tomorrow.

Frugavo's been watching for 6 days. Tomorrow your trial ends and your card will be charged $14.99 to continue monitoring.

Nothing to do — we'll just keep watching. If you'd rather not, cancel from your settings before tomorrow.

${base}/app/settings`;
  return { subject, html: shell({ preheader: "Heads-up before your card is charged tomorrow.", body }), text };
}

function tplPaymentDeclined(_data: Record<string, string | number>): Rendered {
  const base = appUrl().replace(/\/$/, "");
  const subject = "Heads up — your card was declined";
  const body = `
    ${h1("Heads up — your card was declined.")}
    ${p("We tried to charge your card for this month's protection and it didn't go through. Stripe will retry automatically over the next few days.")}
    ${p("Monitoring is still active. If the retries fail, we'll send another note before anything changes.")}
    <div style="margin:18px 0 6px 0;">${cta(`${base}/app/settings`, "Update payment method")}</div>
  `;
  const text = `Heads up — your card was declined.

We tried to charge your card for this month's protection and it didn't go through. Stripe will retry automatically over the next few days.

Monitoring is still active. Update your card at:
${base}/app/settings`;
  return { subject, html: shell({ preheader: "A small heads-up — your card didn't go through.", body }), text };
}

function tplPaymentRetryT72(_data: Record<string, string | number>): Rendered {
  const base = appUrl().replace(/\/$/, "");
  const subject = "Still here — try a different card?";
  const body = `
    ${h1("Still here — try a different card?")}
    ${p("It's been a few days. Stripe is still retrying your card but the charges keep failing. Adding a new payment method takes about 30 seconds and keeps your protection on without interruption.")}
    <div style="margin:18px 0 6px 0;">${cta(`${base}/app/settings`, "Update payment method")}</div>
  `;
  const text = `Still here — try a different card?

It's been a few days. Stripe is still retrying but the charges keep failing. Adding a new payment method takes about 30 seconds and keeps your protection on.

${base}/app/settings`;
  return { subject, html: shell({ preheader: "A different card might work better.", body }), text };
}

function tplGraceT10(_data: Record<string, string | number>): Rendered {
  const base = appUrl().replace(/\/$/, "");
  const subject = "Your protection ends in 11 days";
  const body = `
    ${h1("Your protection ends in 11 days.")}
    ${p("Your card has been declining for a week and a half. If the next retry doesn't succeed in the next 11 days, we'll have to pause your monitoring.")}
    ${p("Updating your payment method now keeps everything running. Takes about 30 seconds.")}
    <div style="margin:18px 0 6px 0;">${cta(`${base}/app/settings`, "Update payment method")}</div>
  `;
  const text = `Your protection ends in 11 days.

Your card has been declining for a week and a half. If the next retry doesn't succeed in the next 11 days, we'll have to pause your monitoring.

Update your payment method at:
${base}/app/settings`;
  return { subject, html: shell({ preheader: "A few more days to fix this.", body }), text };
}

function tplGraceT18(_data: Record<string, string | number>): Rendered {
  const base = appUrl().replace(/\/$/, "");
  const subject = "Your protection ends in 3 days";
  const body = `
    ${h1("Your protection ends in 3 days.")}
    ${p("We've been retrying your card for almost three weeks. If we can't process a payment in the next 3 days, monitoring will pause and you'll stop getting alerts.")}
    ${p("Last chance to keep things on — update your card and we'll resume immediately.")}
    <div style="margin:18px 0 6px 0;">${cta(`${base}/app/settings`, "Update payment method", COLOR_DANGER)}</div>
  `;
  const text = `Your protection ends in 3 days.

We've been retrying your card for almost three weeks. If we can't process a payment in the next 3 days, monitoring will pause.

Update your card at:
${base}/app/settings`;
  return { subject, html: shell({ preheader: "Last call before monitoring pauses.", body }), text };
}

function tplProtectionPaused(_data: Record<string, string | number>): Rendered {
  const base = appUrl().replace(/\/$/, "");
  const subject = "Your protection has paused.";
  const body = `
    ${h1("Your protection has paused.")}
    ${p("After three weeks of declined retries, we've paused monitoring on your account. You won't get alerts about new charges or price hikes until you restart.")}
    ${p("Restarting takes one click. Your existing data stays — we just resume watching from where we left off.")}
    <div style="margin:18px 0 6px 0;">${cta(`${base}/app/billing/restart`, "Restart protection")}</div>
  `;
  const text = `Your protection has paused.

After three weeks of declined retries, we've paused monitoring on your account. You won't get alerts about new charges or price hikes until you restart.

Restart at:
${base}/app/billing/restart`;
  return { subject, html: shell({ preheader: "Monitoring is paused. Restart any time.", body }), text };
}

function tplProtectionEnded(_data: Record<string, string | number>): Rendered {
  const base = appUrl().replace(/\/$/, "");
  const subject = "We'll miss you.";
  const body = `
    ${h1("We'll miss you.")}
    ${p("Your Frugavo protection ended today. Monitoring is off — no more alerts, no more watchfulness for new charges or price hikes.")}
    ${p("Your historical data stays in your account. If you ever want to come back, restart from your dashboard and we'll pick right back up.")}
    <div style="margin:18px 0 6px 0;">${cta(`${base}/app`, "Open dashboard")}</div>
  `;
  const text = `We'll miss you.

Your Frugavo protection ended today. Monitoring is off — no more alerts.

Your historical data stays. Restart any time from your dashboard:
${base}/app`;
  return { subject, html: shell({ preheader: "Your protection has ended.", body }), text };
}
