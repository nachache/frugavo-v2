// Send a one-time signup notification when a new user first lands on
// the dashboard. Used by /app/page.tsx — after the app_users upsert
// it calls maybeNotifySignup(), which is a no-op if the user was
// already notified.
//
// Three independent channels, all best-effort:
//
//   1. hello@frugavo.com — the canonical ops mailbox.
//   2. OPS_NOTIFY_EMAILS (env) — comma-separated personal addresses
//      that get the same email. Set this to your real inbox so the
//      ping reaches you whether or not hello@ forwards correctly.
//   3. SLACK_OPS_WEBHOOK_URL (env) — optional Slack incoming webhook.
//      When set, posts a compact JSON message so you get a real-time
//      notification in your phone / desktop Slack the moment a signup
//      lands.
//
// All three fan out from the SAME reservation pass; the dispatch row
// (signup_notified_at) is stamped exactly once per user. If any
// channel fails, the others still run — none of them block dashboard
// render and none of them prevent the row from being stamped.

import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/notifications/send-email";

const PRIMARY_NOTIFY_TO = "hello@frugavo.com";

function extraEmailRecipients(): string[] {
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

  // ── Channel 1+2: email recipients ──────────────────────────────
  // Single Resend call to the primary + any OPS_NOTIFY_EMAILS extras.
  // Treating it as one send keeps Resend logs tidy and means a single
  // failure path to log if it fails.
  const allEmailRecipients: string[] = [
    PRIMARY_NOTIFY_TO,
    ...extraEmailRecipients(),
  ];
  const result = await sendEmail({
    to: allEmailRecipients,
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
