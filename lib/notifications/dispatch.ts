// Notification dispatch.
//
// Two entry points:
//
//   dispatchUrgentForUser(userId, alertIds)
//     Called from the monitoring orchestrator immediately after
//     monitoring_alerts gets new rows. Filters to urgent types,
//     respects per-user preferences, sends one email per urgent
//     alert. Deduped by (alert_id, channel).
//
//   dispatchDigestForUser(userId, runKey)
//     Called by the digest cron. Collects every active alert created
//     since the user's last digest (or, if no prior digest, in the
//     last 24 hours). Filters out urgent ones (already sent) and any
//     types the user disabled. Sends one bundled email. Deduped by
//     (digest_key, channel) where digest_key = `digest:USER:YYYY-MM-DD`.
//
// Both paths write rows to email_dispatches whether they succeed or
// fail, so the next run sees the prior attempt and won't retry. To
// re-send a failed email we'd add an explicit retry endpoint — for
// now, fire-and-forget is the right tradeoff.

import { supabaseAdmin } from "@/lib/supabase";
import type { Alert } from "@/lib/monitoring/types";
import {
  isUrgent,
  type DispatchRecord,
} from "./types";
import {
  loadPreferences,
  emailAllowed,
  typeAllowed,
} from "./preferences";
import { sendEmail } from "./send-email";
import { buildUnsubscribeUrl } from "./unsubscribe";
import {
  renderUrgentEmail,
  renderDigestEmail,
} from "./templates";

function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.URL ??
    "https://frugavo.com"
  );
}

async function recordDispatch(rec: DispatchRecord): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("email_dispatches").insert({
    user_id: rec.user_id,
    alert_id: rec.alert_id,
    digest_key: rec.digest_key,
    channel: rec.channel,
    send_kind: rec.send_kind,
    to_email: rec.to_email,
    subject: rec.subject,
    provider_id: rec.provider_id ?? null,
    status: rec.status,
    error_msg: rec.error_msg ?? null,
  });
}

async function getUserEmail(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

// ─── Urgent path ──────────────────────────────────────────────────

export async function dispatchUrgentForUser(opts: {
  userId: string;
  alertIds: string[]; // ids that were just inserted; we filter to urgent inside
}): Promise<{ sent: number; skipped: number; failed: number }> {
  const out = { sent: 0, skipped: 0, failed: 0 };
  if (!supabaseAdmin || opts.alertIds.length === 0) return out;

  const prefs = await loadPreferences(opts.userId);
  if (!emailAllowed(prefs) || !prefs.urgent_immediate_enabled) {
    out.skipped = opts.alertIds.length;
    return out;
  }

  // ─── Onboarding grace ──────────────────────────────────────────
  //
  // Suppress urgent alerts immediately after first-ready completes
  // so the user's first impression is the calm "we analyzed your
  // recurring spending" moment — not an inbox full of urgent
  // warnings before they've ever sat down with the dashboard.
  //
  // The grace lifts when EITHER:
  //   - 24 hours have passed since first_ready_at, OR
  //   - the user has had a MEANINGFUL first dashboard session,
  //     tracked via app_users.dashboard_first_session_at. That
  //     column is stamped only after ≥12s of visible dwell or an
  //     interaction (click/scroll/keydown) — see
  //     components/app/dashboard-session-pinger.tsx +
  //     app/api/user/dashboard-session/route.ts.
  //
  // Whichever comes first. Note: we INTENTIONALLY do not use
  // welcomed_at as the release signal — it gets auto-stamped on
  // first /app load for paid users via the dashboard self-heal,
  // which means a 200ms accidental refresh on Stripe success would
  // release the grace before the user has actually seen anything.
  // dashboard_first_session_at is the stricter "they really sat
  // down with it" signal.
  //
  // Alerts are still inserted into monitoring_alerts during this
  // window; the dashboard surfaces them in-product. We're
  // suppressing the EMAIL fanout only.
  {
    const { data: u } = await supabaseAdmin
      .from("app_users")
      .select("first_ready_at, dashboard_first_session_at")
      .eq("id", opts.userId)
      .maybeSingle();
    if (u?.first_ready_at && !u.dashboard_first_session_at) {
      const readyMs = new Date(u.first_ready_at).getTime();
      const ageMs = Date.now() - readyMs;
      if (ageMs < 24 * 60 * 60 * 1000) {
        // eslint-disable-next-line no-console
        console.info(
          "[notifications/dispatch] urgent suppressed — onboarding grace",
          {
            userId: opts.userId,
            ageHours: Math.round(ageMs / 3600 / 1000),
            dashboard_first_session_at: u.dashboard_first_session_at,
          }
        );
        out.skipped = opts.alertIds.length;
        return out;
      }
    }
  }

  const email = await getUserEmail(opts.userId);
  if (!email) {
    out.skipped = opts.alertIds.length;
    return out;
  }

  // Pull the full alert rows for the candidate ids.
  const { data: rows } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("*")
    .in("id", opts.alertIds);

  const alerts = (rows ?? []) as Alert[];

  for (const a of alerts) {
    if (!isUrgent(a)) {
      out.skipped += 1;
      continue;
    }
    if (!typeAllowed(prefs, a.alert_type)) {
      out.skipped += 1;
      continue;
    }

    const base = appUrl();
    const unsubAll = buildUnsubscribeUrl({
      baseUrl: base,
      userId: opts.userId,
      alertType: "all",
    });
    const manageUrl = `${base.replace(/\/$/, "")}/app/settings/notifications`;
    const rendered = renderUrgentEmail({
      alert: a,
      appUrl: base,
      unsubscribeUrl: unsubAll,
      managePreferencesUrl: manageUrl,
    });

    const send = await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      listUnsubscribeUrl: unsubAll,
      tags: { kind: "urgent", alert_type: a.alert_type },
    });

    await recordDispatch({
      user_id: opts.userId,
      alert_id: a.id,
      digest_key: null,
      channel: "email",
      send_kind: "urgent",
      to_email: email,
      subject: rendered.subject,
      provider_id: send.provider_id,
      status: send.ok ? "sent" : "failed",
      error_msg: send.ok ? null : send.error,
    });

    if (send.ok) out.sent += 1;
    else out.failed += 1;
  }

  return out;
}

// ─── Digest path ──────────────────────────────────────────────────

export async function dispatchDigestForUser(opts: {
  userId: string;
  digestKey: string;          // e.g. "digest:USER:2026-05-23"
  digestDateLabel: string;    // e.g. "May 23, 2026"
}): Promise<{
  ok: boolean;
  reason?: string;
  sent: boolean;
  alert_count: number;
}> {
  const out = { ok: false, sent: false, alert_count: 0 } as {
    ok: boolean;
    reason?: string;
    sent: boolean;
    alert_count: number;
  };
  if (!supabaseAdmin) {
    out.reason = "no_supabase";
    return out;
  }

  // Dedup early — if a row already exists for this digest_key we bail.
  const { data: prior } = await supabaseAdmin
    .from("email_dispatches")
    .select("id")
    .eq("digest_key", opts.digestKey)
    .eq("channel", "email")
    .maybeSingle();
  if (prior) {
    out.ok = true;
    out.reason = "already_sent";
    return out;
  }

  const prefs = await loadPreferences(opts.userId);
  if (!emailAllowed(prefs) || prefs.digest_cadence === "off") {
    out.ok = true;
    out.reason = "user_opted_out";
    return out;
  }
  // Cadence gate. The biweekly cron fires every other day; if the user
  // chose weekly or monthly, only send when "today" is their cadence
  // anchor (Monday for weekly, 1st of month for monthly). Daily users
  // get every run.
  if (!cadenceFiresToday(prefs.digest_cadence)) {
    out.ok = true;
    out.reason = "cadence_not_today";
    return out;
  }

  const email = await getUserEmail(opts.userId);
  if (!email) {
    out.ok = true;
    out.reason = "no_email";
    return out;
  }

  // Pull active alerts created in the last 24h that the user has not
  // already received in the urgent path.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("*")
    .eq("user_id", opts.userId)
    .eq("status", "active")
    .gte("created_at", since)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });

  let candidates = (rows ?? []) as Alert[];

  // Filter out alerts the user has disabled for their type.
  candidates = candidates.filter((a) => typeAllowed(prefs, a.alert_type));

  // Remove urgent alerts that already went out individually. Look up
  // their dispatched-alert ids in the urgent kind.
  if (candidates.length > 0) {
    const ids = candidates.map((a) => a.id);
    const { data: sentRows } = await supabaseAdmin
      .from("email_dispatches")
      .select("alert_id")
      .in("alert_id", ids)
      .eq("send_kind", "urgent")
      .eq("status", "sent");
    const sentIds = new Set(
      (sentRows ?? []).map((r) => r.alert_id as string)
    );
    candidates = candidates.filter((a) => !sentIds.has(a.id));
  }

  out.alert_count = candidates.length;

  if (candidates.length === 0) {
    // Don't send an empty digest. Still record the digest_key so the
    // dedup constraint prevents the same hour double-firing.
    await recordDispatch({
      user_id: opts.userId,
      alert_id: null,
      digest_key: opts.digestKey,
      channel: "email",
      send_kind: "digest",
      to_email: email,
      subject: "(skipped — no new alerts)",
      provider_id: null,
      status: "sent",
      error_msg: "no_active_alerts",
    });
    out.ok = true;
    out.reason = "no_new_alerts";
    return out;
  }

  const base = appUrl();
  const unsubAll = buildUnsubscribeUrl({
    baseUrl: base,
    userId: opts.userId,
    alertType: "all",
  });
  const manageUrl = `${base.replace(/\/$/, "")}/app/settings/notifications`;
  const rendered = renderDigestEmail({
    alerts: candidates,
    digestDate: opts.digestDateLabel,
    appUrl: base,
    unsubscribeUrl: unsubAll,
    managePreferencesUrl: manageUrl,
  });

  const send = await sendEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    listUnsubscribeUrl: unsubAll,
    tags: { kind: "digest" },
  });

  await recordDispatch({
    user_id: opts.userId,
    alert_id: null,
    digest_key: opts.digestKey,
    channel: "email",
    send_kind: "digest",
    to_email: email,
    subject: rendered.subject,
    provider_id: send.provider_id,
    status: send.ok ? "sent" : "failed",
    error_msg: send.ok ? null : send.error,
  });

  out.ok = send.ok;
  out.sent = send.ok;
  if (!send.ok) out.reason = send.error ?? "send_failed";
  return out;
}

// Returns true if the given digest cadence should fire on the
// current day (server clock, UTC-normalized). Used by the digest
// cron so weekly/monthly users only receive on their anchor days.
function cadenceFiresToday(
  cadence: "daily" | "weekly" | "monthly" | "off"
): boolean {
  if (cadence === "off") return false;
  if (cadence === "daily") return true;
  const now = new Date();
  if (cadence === "weekly") {
    // Monday = 1 (Sun=0, Sat=6). Anchor digests to Monday.
    return now.getUTCDay() === 1;
  }
  if (cadence === "monthly") {
    return now.getUTCDate() === 1;
  }
  return false;
}
