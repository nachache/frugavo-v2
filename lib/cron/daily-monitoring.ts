// Daily monitoring cron orchestration.
//
// One sweep per hour. On each invocation:
//
//   1. Compute the current UTC hour.
//   2. Resolve which IANA timezones map to "local hour == TARGET_HOUR"
//      right now (TARGET_HOUR = 6 by default, so 6am user-local).
//   3. Pull every app_user whose stored timezone matches.
//   4. For each user, claim a cron_runs row keyed by (cron_name,
//      run_key, user_id) where run_key = the user's local YYYY-MM-DD.
//      The unique constraint enforces "at most one sweep per user
//      per local day", so retries / double-fires no-op silently.
//   5. Run runScanForUser(uid, 'cron'). The scan itself calls
//      runMonitoringForUser as part of its normal post-scan path, so
//      we don't need to invoke detectors twice.
//   6. Update the cron_runs row with finish status + detected counts.
//
// Failure model: a single user crashing must not stop the sweep. We
// wrap each user in try/catch and mark the cron_runs row as 'failed'
// with the error message captured in error_msg + details.
//
// Concurrency: the unique index on (cron_name, run_key, user_id) acts
// as our distributed lock. Two pods firing the same hour both try to
// insert the claim row; one wins, the other gets a unique-violation
// and skips.
//
// Cost model: at scale we'd swap the inline for-loop for a QStash
// fanout (one message per user), but for now a sequential sweep
// inside a single Netlify scheduled function is fine.

import { supabaseAdmin } from "@/lib/supabase";
import { runScanForUser } from "@/lib/scan";

const CRON_NAME = "daily-monitoring";
const TARGET_LOCAL_HOUR = 6; // 6am user-local

export type SweepResult = {
  ok: boolean;
  utc_hour: number;
  matched_timezones: string[];
  matched_users: number;
  scanned: number;
  skipped_already_run: number;
  failed: number;
  run_key_sample: string | null;
  duration_ms: number;
};

// ─── Timezone math ────────────────────────────────────────────────

/**
 * Returns the integer local hour for an IANA timezone at `at` time.
 * Uses Intl.DateTimeFormat under the hood, which is the right call
 * for DST-correctness — manual offset math gets it wrong every March.
 */
export function localHourInTimezone(tz: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).formatToParts(at);
    const h = parts.find((p) => p.type === "hour")?.value;
    if (!h) return null;
    const n = parseInt(h, 10);
    if (Number.isNaN(n)) return null;
    // Intl returns '24' for midnight in some locales — normalize.
    return n === 24 ? 0 : n;
  } catch {
    return null;
  }
}

/**
 * Returns YYYY-MM-DD for an IANA timezone at `at` time. Used as the
 * cron_runs.run_key so two sweeps on the same local calendar day
 * collide on the unique constraint.
 */
export function localDateInTimezone(tz: string, at: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(at);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (!y || !m || !d) return null;
    return `${y}-${m}-${d}`;
  } catch {
    return null;
  }
}

// ─── Sweep ─────────────────────────────────────────────────────────

export async function runDailyMonitoringSweep(
  opts: { at?: Date; forceUserIds?: string[] } = {}
): Promise<SweepResult> {
  const startedAt = Date.now();
  const at = opts.at ?? new Date();
  const utcHour = at.getUTCHours();

  const result: SweepResult = {
    ok: false,
    utc_hour: utcHour,
    matched_timezones: [],
    matched_users: 0,
    scanned: 0,
    skipped_already_run: 0,
    failed: 0,
    run_key_sample: null,
    duration_ms: 0,
  };

  if (!supabaseAdmin) {
    result.duration_ms = Date.now() - startedAt;
    return result;
  }

  // Pull every distinct timezone we have on app_users. Compare each
  // to "right now"; collect the ones whose local hour matches.
  //
  // Distinct-timezone count is bounded by the number of IANA zones
  // (~400), well within a single query. For overrides (testing) we
  // accept forceUserIds and bypass timezone filtering entirely.
  let users: { id: string; timezone: string }[] = [];

  if (opts.forceUserIds && opts.forceUserIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("app_users")
      .select("id, timezone")
      .in("id", opts.forceUserIds);
    users = (data ?? []) as typeof users;
  } else {
    const { data: tzRows } = await supabaseAdmin
      .from("app_users")
      .select("timezone")
      .not("timezone", "is", null);
    const distinctTzs = Array.from(
      new Set((tzRows ?? []).map((r) => r.timezone as string))
    );
    const matchedTzs = distinctTzs.filter(
      (tz) => localHourInTimezone(tz, at) === TARGET_LOCAL_HOUR
    );
    result.matched_timezones = matchedTzs;
    if (matchedTzs.length === 0) {
      result.ok = true;
      result.duration_ms = Date.now() - startedAt;
      return result;
    }
    const { data } = await supabaseAdmin
      .from("app_users")
      .select("id, timezone")
      .in("timezone", matchedTzs);
    users = (data ?? []) as typeof users;
  }

  result.matched_users = users.length;

  // Only sweep users who have a connected bank. No point firing the
  // scan path for someone whose Plaid connection doesn't exist —
  // wastes a cron_runs row and a no-op runScanForUser call.
  if (users.length > 0) {
    const userIds = users.map((u) => u.id);
    const { data: bankedRows } = await supabaseAdmin
      .from("plaid_items")
      .select("user_id")
      .in("user_id", userIds);
    const banked = new Set(
      (bankedRows ?? []).map((r) => r.user_id as string)
    );
    users = users.filter((u) => banked.has(u.id));
  }

  for (const u of users) {
    const runKey = localDateInTimezone(u.timezone, at) ?? "unknown";
    if (!result.run_key_sample) result.run_key_sample = runKey;

    // Claim the slot. ON CONFLICT DO NOTHING via upsert — if the row
    // already exists for this user/day we silently skip.
    const claim = await supabaseAdmin
      .from("cron_runs")
      .insert({
        cron_name: CRON_NAME,
        run_key: runKey,
        user_id: u.id,
        status: "started",
      })
      .select("id")
      .maybeSingle();

    if (!claim.data) {
      result.skipped_already_run += 1;
      continue;
    }

    try {
      const scan = await runScanForUser(u.id, "cron");
      result.scanned += 1;
      await supabaseAdmin
        .from("cron_runs")
        .update({
          status: scan.error ? "failed" : "finished",
          finished_at: new Date().toISOString(),
          error_msg: scan.error ?? null,
          details: {
            scan_id: scan.scan_id,
            detected: scan.detected ?? null,
            failed_items: scan.failedItems ?? 0,
            duration_ms: scan.duration_ms ?? null,
          },
        })
        .eq("id", claim.data.id);
      if (scan.error) result.failed += 1;
    } catch (e) {
      result.failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("cron_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_msg: msg,
        })
        .eq("id", claim.data.id);
    }
  }

  result.ok = true;
  result.duration_ms = Date.now() - startedAt;
  return result;
}
