import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/notifications/send-email";

// POST /api/learning/feedback
//
// Body: {
//   kind: 'founder_modal' | 'insight' | 'accuracy' | 'surprise'
//         | 'session_standout' | 'would_miss',
//   payload: {...}
// }
//
// Single entry point for every typed feedback signal in the system.
// Routes to the right table based on `kind` and, for 'founder_modal',
// also fans out to email + Slack so the founder gets notified in
// real time.
//
// The auth gate is Clerk. Anonymous feedback is not allowed during
// beta — the design assumes a future conversation with the user.

export const runtime = "nodejs";
export const maxDuration = 5;

type Payload = Record<string, unknown>;

function s(v: unknown, max = 4000): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function n(v: unknown, allowed: number[]): number | null {
  return typeof v === "number" && allowed.includes(v) ? v : null;
}

function b(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: { kind?: unknown; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const kind = s(body.kind, 32);
  const payload: Payload = (body.payload && typeof body.payload === "object"
    ? (body.payload as Payload)
    : {}) as Payload;

  switch (kind) {
    case "founder_modal":
      return handleFounderModal(user.id, payload, req);
    case "insight":
      return handleInsight(user.id, payload);
    case "accuracy":
      return handleAccuracy(user.id, payload);
    case "surprise":
      return handleSurprise(user.id, payload);
    case "session_standout":
    case "would_miss":
      return handleFreeform(user.id, kind, payload, req);
    default:
      return NextResponse.json({ error: "unknown_kind" }, { status: 400 });
  }
}

// ─── founder modal ──────────────────────────────────────────────
//
// Three writes in parallel:
//   1. INSERT feedback_freeform
//   2. sendEmail to hello@ + OPS_NOTIFY_EMAILS
//   3. Slack webhook (if configured)
//
// Failures in any one channel never block the others. The DB write
// is the source of truth — email + Slack are notifications.

async function handleFounderModal(
  clerkUserId: string,
  payload: Payload,
  req: Request
): Promise<NextResponse> {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const message = s(payload.message, 8000);
  if (!message) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }
  const sourceUrl = s(payload.source_url, 1024);
  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;

  // 1 — DB write
  const { data: row, error: insertErr } = await supabaseAdmin
    .from("feedback_freeform")
    .insert({
      clerk_user_id: clerkUserId,
      prompt: "founder_modal",
      message,
      source_url: sourceUrl,
      user_agent: userAgent,
    })
    .select("id")
    .maybeSingle();
  if (insertErr) {
    return NextResponse.json(
      { error: "db_insert_failed", details: insertErr.message },
      { status: 500 }
    );
  }
  const feedbackId = row?.id ?? null;

  // Resolve user email for the founder notifications.
  let userEmail: string | null = null;
  let userName: string | null = null;
  try {
    const u = await clerkClient().users.getUser(clerkUserId);
    userEmail =
      u.primaryEmailAddress?.emailAddress ??
      u.emailAddresses[0]?.emailAddress ??
      null;
    userName =
      [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
  } catch {
    // Non-fatal — we can still send the notification without it.
  }

  const subject = `Frugavo feedback: ${userEmail ?? clerkUserId}`;
  const adminUrl = (() => {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
    return base
      ? `${base.replace(/\/$/, "")}/app/admin/learning${feedbackId ? `?focus=${feedbackId}` : ""}`
      : null;
  })();

  const textLines = [
    `New feedback submitted via the founder chip.`,
    ``,
    `  From:    ${userEmail ?? "(no email)"}${userName ? ` · ${userName}` : ""}`,
    `  User id: ${clerkUserId}`,
    `  On URL:  ${sourceUrl ?? "(unknown)"}`,
    ``,
    `Message:`,
    ``,
    message,
    ``,
    `--`,
    adminUrl ? `Open in admin: ${adminUrl}` : "",
    `Frugavo ops notification`,
  ].filter(Boolean);
  const text = textLines.join("\n");
  const html = `<pre style="font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.55; white-space: pre-wrap;">${escapeHtml(
    text
  )}</pre>`;

  // 2 — Email fanout (best-effort; failures logged but not surfaced)
  const recipients = [
    "hello@frugavo.com",
    ...(process.env.OPS_NOTIFY_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  void sendEmail({
    to: recipients,
    subject,
    html,
    text,
    tags: { kind: "ops", type: "founder_feedback" },
  }).catch(() => {
    /* logged inside sendEmail; non-fatal */
  });

  // 3 — Slack fanout
  const slackUrl = (process.env.SLACK_OPS_WEBHOOK_URL ?? "").trim();
  if (slackUrl.startsWith("https://hooks.slack.com/")) {
    void fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:
          `:speech_balloon: *New Frugavo feedback*\n` +
          `*From:* ${userEmail ?? "_no email_"}${userName ? ` · ${userName}` : ""}\n` +
          `*URL:* ${sourceUrl ?? "_unknown_"}\n` +
          `>>> ${message.slice(0, 1000)}${message.length > 1000 ? "…" : ""}`,
      }),
    }).catch(() => {
      /* swallow; logged via the response in production */
    });
  }

  return NextResponse.json({ ok: true, id: feedbackId });
}

// ─── insight vote ───────────────────────────────────────────────
//
// One vote per (user, insight_key). Unique constraint enforces.
// On conflict we just return ok — the user already voted, the
// design treats votes as moment-in-time so we don't allow updates.

async function handleInsight(
  clerkUserId: string,
  payload: Payload
): Promise<NextResponse> {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const insight_kind = s(payload.insight_kind, 64);
  const insight_key = s(payload.insight_key, 128);
  const vote = n(payload.vote, [-1, 1]);
  const reason = s(payload.reason, 32);
  const reason_freeform = s(payload.reason_freeform, 1000);
  const session_id = s(payload.session_id, 64);
  if (!insight_kind || !insight_key || vote === null) {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("feedback_insights").insert({
    clerk_user_id: clerkUserId,
    session_id,
    insight_kind,
    insight_key,
    vote,
    reason,
    reason_freeform,
  });
  if (error) {
    // Unique violation = already voted; that's fine.
    if (isUniqueViolation(error)) {
      return NextResponse.json({ ok: true, already_voted: true });
    }
    return NextResponse.json(
      { error: "db_insert_failed", details: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

// ─── accuracy ───────────────────────────────────────────────────

async function handleAccuracy(
  clerkUserId: string,
  payload: Payload
): Promise<NextResponse> {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const subscription_id = s(payload.subscription_id, 64);
  if (!subscription_id) {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }
  const merchant_correct = b(payload.merchant_correct);
  const recurrence_correct = b(payload.recurrence_correct);
  const amount_correct = b(payload.amount_correct);
  const category_correct = b(payload.category_correct);
  const notes = s(payload.notes, 2000);
  const { error } = await supabaseAdmin.from("feedback_accuracy").insert({
    clerk_user_id: clerkUserId,
    subscription_id,
    merchant_correct,
    recurrence_correct,
    amount_correct,
    category_correct,
    notes,
  });
  if (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ ok: true, already_submitted: true });
    }
    return NextResponse.json(
      { error: "db_insert_failed", details: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

// ─── surprise ───────────────────────────────────────────────────

async function handleSurprise(
  clerkUserId: string,
  payload: Payload
): Promise<NextResponse> {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const surface = s(payload.surface, 64);
  const surface_key = s(payload.surface_key, 128);
  const rating = n(payload.rating, [0, 1, 2]);
  if (!surface || rating === null) {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("feedback_surprise").insert({
    clerk_user_id: clerkUserId,
    surface,
    surface_key,
    rating,
  });
  if (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ ok: true, already_rated: true });
    }
    return NextResponse.json(
      { error: "db_insert_failed", details: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

// ─── session_standout / would_miss ──────────────────────────────

async function handleFreeform(
  clerkUserId: string,
  prompt: string,
  payload: Payload,
  req: Request
): Promise<NextResponse> {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const message = s(payload.message, 8000);
  const option_picked = s(payload.option_picked, 64);
  if (!message && !option_picked) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }
  const sourceUrl = s(payload.source_url, 1024);
  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;
  const { error } = await supabaseAdmin.from("feedback_freeform").insert({
    clerk_user_id: clerkUserId,
    prompt,
    message,
    option_picked,
    source_url: sourceUrl,
    user_agent: userAgent,
  });
  if (error) {
    return NextResponse.json(
      { error: "db_insert_failed", details: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

// ─── helpers ─────────────────────────────────────────────────────

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "23505" || code === 23505;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
