// Daily dunning sweep.
//
// Sends the time-driven billing emails (the ones the projector can't
// trigger directly because they fire on elapsed time, not state
// changes):
//
//   trial_converts_t6  — trialing users with trial_end < now() + 24h
//   payment_retry_t72  — grace_period users where most recent decline
//                        was ~72h ago (3 days)
//   grace_t10          — grace_period users with expires_at - now() ≈ 11d
//   grace_t18          — grace_period users with expires_at - now() ≈ 3d
//
// Event-driven sends (trial_started, payment_declined,
// protection_paused, protection_ended) happen from the projector
// side-effect path, not here.
//
// Idempotency comes from billing_email_dispatches — even if this
// sweep runs twice on the same day, the unique constraint blocks
// duplicate sends.

import { supabaseAdmin } from "@/lib/supabase";
import { sendBillingEmail } from "@/lib/billing/emails";
import { clerkClient } from "@clerk/nextjs/server";

const DAY_MS = 86_400_000;

export type DunningSweepResult = {
  scanned: number;
  trial_t6_sent: number;
  payment_retry_t72_sent: number;
  grace_t10_sent: number;
  grace_t18_sent: number;
  failed: number;
};

export async function runDunningSweep(): Promise<DunningSweepResult> {
  const result: DunningSweepResult = {
    scanned: 0,
    trial_t6_sent: 0,
    payment_retry_t72_sent: 0,
    grace_t10_sent: 0,
    grace_t18_sent: 0,
    failed: 0,
  };

  if (!supabaseAdmin) return result;

  const now = Date.now();

  // ─── trial_converts_t6: trialing with trial_end in the next 24h ─
  const { data: trialing } = await supabaseAdmin
    .from("billing_entitlements")
    .select("clerk_user_id, stripe_subscription_id, trial_ends_at")
    .eq("entitlement_state", "trialing")
    .not("trial_ends_at", "is", null)
    .gte("trial_ends_at", new Date(now).toISOString())
    .lte("trial_ends_at", new Date(now + DAY_MS).toISOString());

  for (const row of trialing ?? []) {
    result.scanned++;
    const email = await getUserEmail(row.clerk_user_id);
    if (!email) continue;
    const ok = await sendBillingEmail({
      clerkUserId: row.clerk_user_id,
      emailType: "trial_converts_t6",
      dedupKey: `${row.stripe_subscription_id ?? "no_sub"}:t6`,
      to: email,
    });
    if (ok) result.trial_t6_sent++;
    else result.failed++;
  }

  // ─── grace_t10 / grace_t18 / payment_retry_t72 ─
  // grace_period rows carry expires_at = first_failure + 21d. From
  // that we derive elapsed days inside grace.
  const { data: grace } = await supabaseAdmin
    .from("billing_entitlements")
    .select("clerk_user_id, stripe_subscription_id, expires_at")
    .eq("entitlement_state", "grace_period")
    .not("expires_at", "is", null);

  for (const row of grace ?? []) {
    result.scanned++;
    if (!row.expires_at) continue;
    const expiresMs = new Date(row.expires_at).getTime();
    const daysToExpiry = (expiresMs - now) / DAY_MS;
    // expires_at = first_failure + 21d. So days since first failure
    // = 21 - daysToExpiry.
    const daysSinceFailure = 21 - daysToExpiry;

    const email = await getUserEmail(row.clerk_user_id);
    if (!email) continue;
    const subDedup = row.stripe_subscription_id ?? "no_sub";

    // T+72h after first decline (~3 days). Send between day 2.5 and
    // day 3.5 so the cron has a window to catch it.
    if (daysSinceFailure >= 2.5 && daysSinceFailure < 3.5) {
      const ok = await sendBillingEmail({
        clerkUserId: row.clerk_user_id,
        emailType: "payment_retry_t72",
        dedupKey: `${subDedup}:retry_t72`,
        to: email,
      });
      if (ok) result.payment_retry_t72_sent++;
      else result.failed++;
    }

    // T+10d: protection ends in 11 days. Send between day 9.5 and 10.5.
    if (daysToExpiry >= 10.5 && daysToExpiry < 11.5) {
      const ok = await sendBillingEmail({
        clerkUserId: row.clerk_user_id,
        emailType: "grace_t10",
        dedupKey: `${subDedup}:grace_t10`,
        to: email,
      });
      if (ok) result.grace_t10_sent++;
      else result.failed++;
    }

    // T+18d: protection ends in 3 days. Send between day 17.5 and 18.5.
    if (daysToExpiry >= 2.5 && daysToExpiry < 3.5) {
      const ok = await sendBillingEmail({
        clerkUserId: row.clerk_user_id,
        emailType: "grace_t18",
        dedupKey: `${subDedup}:grace_t18`,
        to: email,
      });
      if (ok) result.grace_t18_sent++;
      else result.failed++;
    }
  }

  return result;
}

// Lookup helper — pull the user's email from Clerk. The projector
// stores email on stripe_customers but Clerk is the canonical source.
async function getUserEmail(clerkUserId: string): Promise<string | null> {
  try {
    const user = await clerkClient().users.getUser(clerkUserId);
    return (
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null
    );
  } catch {
    return null;
  }
}
