import { supabaseAdmin } from "./supabase";

// Cancellation watcher.
//
// For each cancellation in outcome='pending', we wait until the
// subscription's next_expected_charge_at + a grace window has passed,
// then look at subscription_charges. If a charge appeared at >= 80% of
// the expected amount after the cancellation attempt, the cancellation
// failed (the provider didn't actually stop). Otherwise it's confirmed
// and we flip subscriptions.status to 'cancelled'.
//
// In production the same logic runs against rows that Plaid populates
// via /transactions/sync. In sandbox, charges are seeded historically
// so the success path always wins — which is the right demo behavior.

const GRACE_DAYS = 3;
const CHARGE_MATCH_THRESHOLD = 0.8; // recurring amount can drift ±20%

export type WatcherResult = {
  processed: number;
  confirmed: number;
  failed: number;
  stillPending: number;
};

type PendingRow = {
  id: string;
  attempted_at: string;
  subscription_id: string;
  subscription: {
    id: string;
    amount_cents: number;
    next_expected_charge_at: string | null;
    last_charged_at: string | null;
    status: string;
    frequency: string;
  } | null;
};

export async function runWatcherForUser(
  userId: string,
  now = new Date()
): Promise<WatcherResult> {
  if (!supabaseAdmin) {
    return { processed: 0, confirmed: 0, failed: 0, stillPending: 0 };
  }

  const { data: pending, error } = await supabaseAdmin
    .from("cancellations")
    .select(
      `id, attempted_at, subscription_id,
       subscription:subscriptions (
         id, amount_cents, next_expected_charge_at, last_charged_at, status, frequency
       )`
    )
    .eq("user_id", userId)
    .eq("outcome", "pending");

  if (error || !pending || pending.length === 0) {
    return { processed: 0, confirmed: 0, failed: 0, stillPending: 0 };
  }

  let confirmed = 0;
  let failed = 0;
  let stillPending = 0;

  for (const raw of pending as unknown as PendingRow[]) {
    const sub = raw.subscription;
    if (!sub) continue;

    // Figure out when we'd expect the next charge. If Plaid didn't give
    // us a predicted date, fall back to last_charged_at + one period.
    const expected = expectedNextCharge(sub, raw.attempted_at);
    if (!expected) {
      stillPending += 1;
      continue;
    }
    const judgeAfter = new Date(expected.getTime() + GRACE_DAYS * 86_400_000);
    if (judgeAfter > now) {
      stillPending += 1;
      continue;
    }

    // Look for a real charge at the expected amount in the window
    // [attempted_at, now]. Anything >= 80% of expected counts as
    // "still being charged" — covers fees, taxes, plan changes.
    const minAmount = Math.round(sub.amount_cents * CHARGE_MATCH_THRESHOLD);
    const { data: charges } = await supabaseAdmin
      .from("subscription_charges")
      .select("amount_cents, charged_at")
      .eq("subscription_id", sub.id)
      .gte("charged_at", raw.attempted_at.slice(0, 10))
      .gte("amount_cents", minAmount);

    const stillBilled = (charges ?? []).length > 0;

    if (stillBilled) {
      await supabaseAdmin
        .from("cancellations")
        .update({
          outcome: "failed",
          outcome_set_at: now.toISOString(),
          notes: `Charge of $${((charges ?? [])[0].amount_cents / 100).toFixed(2)} on ${(charges ?? [])[0].charged_at} after cancellation attempt`,
        })
        .eq("id", raw.id);

      await supabaseAdmin
        .from("subscriptions")
        .update({
          user_decision: "unsure",
          updated_at: now.toISOString(),
        })
        .eq("id", sub.id);

      failed += 1;
    } else {
      await supabaseAdmin
        .from("cancellations")
        .update({
          outcome: "confirmed_via_plaid",
          outcome_set_at: now.toISOString(),
        })
        .eq("id", raw.id);

      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "cancelled",
          updated_at: now.toISOString(),
        })
        .eq("id", sub.id);

      confirmed += 1;
    }
  }

  return {
    processed: pending.length,
    confirmed,
    failed,
    stillPending,
  };
}

// Compute the date we expect the next charge to land. Prefer Plaid's
// predicted_next_charge if present; otherwise advance last_charged_at
// by one frequency period.
function expectedNextCharge(
  sub: { next_expected_charge_at: string | null; last_charged_at: string | null; frequency: string },
  attemptedAt: string
): Date | null {
  if (sub.next_expected_charge_at) {
    const d = new Date(sub.next_expected_charge_at);
    // Only use it if it's in the future relative to the attempt (we
    // don't want to judge against a past "next" date).
    if (d.getTime() >= new Date(attemptedAt).getTime()) {
      return d;
    }
  }
  const last = sub.last_charged_at ? new Date(sub.last_charged_at) : null;
  if (!last) return null;
  const next = new Date(last);
  switch (sub.frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "semi_monthly":
      next.setDate(next.getDate() + 15);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "annually":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

// Used by the cron route to find every user with pending work without
// table-scanning subscriptions.
export async function listUsersWithPendingCancellations(): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("cancellations")
    .select("user_id")
    .eq("outcome", "pending");
  return Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
}
