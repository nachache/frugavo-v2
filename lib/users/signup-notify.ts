// Send a one-time internal notification to hello@frugavo.com when a
// new user first lands on the dashboard. Used by /app/page.tsx —
// after the app_users upsert it calls maybeNotifySignup(), which is
// a no-op if the user was already notified.
//
// Why a separate module: the dashboard page is already long, and
// this concern (ops alerting) is independent of dashboard rendering.

import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/notifications/send-email";

const NOTIFY_TO = "hello@frugavo.com";

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

  const result = await sendEmail({
    to: NOTIFY_TO,
    subject,
    html,
    text,
    tags: { kind: "ops", type: "new_signup" },
  });

  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(
      "[signup-notify] send failed (non-fatal)",
      result.error
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
