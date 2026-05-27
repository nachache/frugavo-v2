import { supabaseAdmin } from "@/lib/supabase";
import { sendCheckinEmail } from "@/lib/email/checkin";

// Find users eligible for the 15-min checkin email and send it.
//
// Eligibility (all must be true):
//   - app_users.checkin_email_sent_at IS NULL  (haven't emailed yet)
//   - app_users.first_ready_at IS NULL         (dashboard not ready)
//   - app_users.email IS NOT NULL              (we have an address)
//   - they have at least one scan_run started > 15 min ago
//
// Idempotent — stamps checkin_email_sent_at on success so the same
// user is never emailed twice. Safe to call from a cron, a webhook,
// or any opportunistic trigger.
//
// Returns the count of emails sent in this pass.

const CHECKIN_DELAY_MINUTES = 15;

export async function dispatchPendingCheckinEmails(): Promise<{
  sent: number;
  failed: number;
  skipped_no_bank: number;
}> {
  if (!supabaseAdmin) {
    return { sent: 0, failed: 0, skipped_no_bank: 0 };
  }

  const cutoffIso = new Date(
    Date.now() - CHECKIN_DELAY_MINUTES * 60 * 1000
  ).toISOString();

  // Find users with at least one scan_run older than 15 min who
  // haven't yet been emailed and haven't reached first_ready_at.
  // Single round-trip via a JOIN.
  const { data: candidates } = await supabaseAdmin
    .from("scan_runs")
    .select(
      "user_id, started_at, app_users!inner(id, email, first_ready_at, checkin_email_sent_at)"
    )
    .lt("started_at", cutoffIso)
    .eq("source", "first_connect")
    .order("started_at", { ascending: true });

  if (!candidates || candidates.length === 0) {
    return { sent: 0, failed: 0, skipped_no_bank: 0 };
  }

  type Row = {
    user_id: string;
    started_at: string;
    app_users:
      | {
          id: string;
          email: string | null;
          first_ready_at: string | null;
          checkin_email_sent_at: string | null;
        }
      | {
          id: string;
          email: string | null;
          first_ready_at: string | null;
          checkin_email_sent_at: string | null;
        }[]
      | null;
  };

  // Dedupe — one user might have multiple scan_runs, we only want
  // to email them once.
  const eligible = new Map<
    string,
    { email: string }
  >();
  for (const row of candidates as unknown as Row[]) {
    const u = Array.isArray(row.app_users)
      ? row.app_users[0] ?? null
      : row.app_users;
    if (!u) continue;
    if (u.first_ready_at) continue; // dashboard already ready
    if (u.checkin_email_sent_at) continue; // already emailed
    if (!u.email) continue;
    if (eligible.has(u.id)) continue;
    eligible.set(u.id, { email: u.email });
  }

  let sent = 0;
  let failed = 0;
  const skippedNoBank = 0;

  for (const [userId, info] of eligible) {
    // Try to grab the bank name for nicer copy. Best-effort.
    const { data: item } = await supabaseAdmin
      .from("plaid_items")
      .select("institution_name")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    try {
      const result = await sendCheckinEmail({
        email: info.email,
        bankName: (item?.institution_name as string | null) ?? null,
      });
      if ("skipped" in result) {
        // eslint-disable-next-line no-console
        console.warn("[checkin-email] skipped for", info.email);
        continue;
      }
      await supabaseAdmin
        .from("app_users")
        .update({ checkin_email_sent_at: new Date().toISOString() })
        .eq("id", userId)
        .is("checkin_email_sent_at", null);
      sent++;
      // eslint-disable-next-line no-console
      console.log(
        "[checkin-email] sent",
        JSON.stringify({ userId, email: info.email, resend_id: result.id })
      );
    } catch (e) {
      failed++;
      // eslint-disable-next-line no-console
      console.error(
        "[checkin-email] FAILED",
        JSON.stringify({
          userId,
          email: info.email,
          error: e instanceof Error ? e.message : String(e),
        })
      );
    }
  }

  return { sent, failed, skipped_no_bank: skippedNoBank };
}
