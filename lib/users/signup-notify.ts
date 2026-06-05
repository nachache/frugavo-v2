// Send a one-time signup notification when a new user first lands on
// the dashboard. Used by /app/page.tsx — after the app_users upsert
// it calls maybeNotifySignup(), which is a no-op if the user was
// already notified.
//
// Two independent channels, both best-effort:
//
//   1. OPS_NOTIFY_EMAILS (env) — comma-separated addresses that
//      receive the signup ping. This is the ONLY email destination
//      for ops alerts. Use personal Gmail / Outlook addresses
//      (different domain from the sender) so deliverability is
//      independent of frugavo.com's customer-facing mailbox.
//   2. SLACK_OPS_WEBHOOK_URL (env) — Slack incoming webhook for
//      real-time push notifications on phone/desktop.
//
// Previously this hardcoded hello@frugavo.com as a primary recipient.
// That created a same-domain self-send (Resend sender on frugavo.com
// → recipient on frugavo.com) which PrivateEmail's anti-spoofing
// filter silently drops. Removed: ops alerts no longer touch any
// frugavo.com address. The customer-facing hello@ inbox is free to
// handle actual customer email without competing with internal noise.
//
// Both channels fan out from the SAME reservation pass; the dispatch
// row (signup_notified_at) is stamped exactly once per user. If a
// channel fails, the other still runs — none of them block dashboard
// render and none of them prevent the row from being stamped.

import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/notifications/send-email";
import { fireRedditCapiEvent } from "@/lib/marketing/reddit-capi";

function opsEmailRecipients(): string[] {
  return (process.env.OPS_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function slackWebhookUrl(): string | null {
  const url = (process.env.SLACK_OPS_WEBHOOK_URL ?? "").trim();
  return url.startsWith("https://hooks.slack.com/") ? url : null;
}

export async function maybeNotifySignup(args: {
  clerkUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}): Promise<void> {
  if (!supabaseAdmin) return;

  // Idempotency: only notify if signup_notified_at is still null.
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("signup_notified_at, created_at, public_slug")
    .eq("id", args.clerkUserId)
    .maybeSingle();

  if (!data) return;
  if (data.signup_notified_at) return; // already notified

  // Reserve the slot BEFORE sending so a concurrent caller can't
  // double-send. If the send fails, we'll log it but won't retry —
  // ops notifications are best-effort, not transactional.
  const { error: reserveErr } = await supabaseAdmin
    .from("app_users")
    .update({ signup_notified_at: new Date().toISOString() })
    .eq("id", args.clerkUserId)
    .is("signup_notified_at", null);

  if (reserveErr) {
    // eslint-disable-next-line no-console
    console.error(
      "[signup-notify] reservation failed (non-fatal)",
      reserveErr
    );
    return;
  }

  const fullName =
    [args.firstName, args.lastName].filter(Boolean).join(" ") || "(no name)";
  const subject = `New Frugavo signup: ${args.email ?? args.clerkUserId}`;
  const lines = [
    `A new user just signed up for Frugavo.`,
    ``,
    `  Email:    ${args.email ?? "(none on Clerk)"}`,
    `  Name:     ${fullName}`,
    `  Clerk id: ${args.clerkUserId}`,
    `  Joined:   ${data.created_at ?? "(unknown)"}`,
    `  Slug:     ${data.public_slug ?? "(not yet provisioned)"}`,
    ``,
    `--`,
    `Frugavo ops notification`,
  ];
  const text = lines.join("\n");
  const html = `<pre style="font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.55;">${escapeHtml(text)}</pre>`;

  // ── Channel 1: email recipients ──────────────────────────────
  // Single Resend call to whatever addresses are in OPS_NOTIFY_EMAILS.
  // No hardcoded hello@frugavo.com — see file header for why.
  // If OPS_NOTIFY_EMAILS is unset, we skip email entirely and let
  // Slack handle the notification alone. That's a deliberate
  // degradation: zero email beats a misconfigured email going
  // somewhere unread.
  const emailRecipients = opsEmailRecipients();
  if (emailRecipients.length > 0) {
    const result = await sendEmail({
      to: emailRecipients,
      subject,
      html,
      text,
      tags: { kind: "ops", type: "new_signup" },
    });

    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error(
        "[signup-notify] email send failed (non-fatal)",
        result.error
      );
    }
  }

  // ── Channel 2: Reddit Conversions API ──────────────────────────
  // Server-side SignUp event with hashed email + Clerk user id as the
  // external_id. Mirrors the client-side rdt('track', 'SignUp') fired
  // from /app/layout.tsx; Reddit dedups on conversion_id (the Clerk
  // user id) so this complements rather than double-counts the pixel.
  //
  // Why this matters: without CAPI the Reddit dashboard reports
  // match quality "N/A" on SignUp (no way to tie the event to a
  // Reddit user), which means Reddit's algorithm can't optimize ad
  // delivery against actual converters. Adding the hashed email here
  // moves that match quality from N/A to ~7+ and lets the
  // optimization engine tighten away from broad interest categories
  // like r/CostcoCanada.
  //
  // Fire-and-forget — fireRedditCapiEvent never throws and never
  // awaits. If Reddit's endpoint is down or the token is wrong, this
  // logs a warning and the rest of the function continues.
  if (args.email) {
    fireRedditCapiEvent({
      eventType: "SignUp",
      conversionId: args.clerkUserId,
      user: {
        email: args.email,
        externalId: args.clerkUserId,
      },
    });
  }

  // ── Channel 3: Slack webhook ───────────────────────────────────
  // Compact one-block message with the same info as the email body.
  // Posts in parallel; Slack failures never affect email delivery
  // and never block the dashboard render.
  const slackUrl = slackWebhookUrl();
  if (slackUrl) {
    try {
      const slackText =
        `:tada: *New Frugavo signup*\n` +
        `*Email:* ${args.email ?? "_none on Clerk_"}\n` +
        `*Name:* ${fullName}\n` +
        `*Clerk id:* \`${args.clerkUserId}\``;
      const res = await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: slackText }),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error(
          "[signup-notify] slack post failed (non-fatal)",
          res.status,
          await res.text().catch(() => "")
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        "[signup-notify] slack post threw (non-fatal)",
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
