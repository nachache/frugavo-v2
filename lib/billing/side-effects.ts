// Side-effect hooks fired by the projector after a state change lands.
//
// Real implementations:
//   - onActivation (PR 5): default notification preferences,
//     trigger a fresh scan if the user already connected a bank,
//     log welcome (real email lands in PR 7)
//   - sendEmail hooks (PR 7): trial start, T+6 reminder, decline,
//     past_due, cancellation
//
// Each hook is best-effort: a failure inside a side effect must
// NOT roll back the projection. The projection table writes are
// the source of truth; emails and scan-queueing are observable
// downstream effects that we can replay if they go missing.

import type {
  ProjectedEntitlement,
  ProjectedSubscription,
} from "@/lib/billing/projector";
import { supabaseAdmin } from "@/lib/supabase";
import { savePreferences } from "@/lib/notifications/preferences";
import { sendBillingEmail } from "@/lib/billing/emails";
import { clerkClient } from "@clerk/nextjs/server";

export type SideEffectContext = {
  clerkUserId: string;
  // Previous entitlement state, or null if this is the first time
  // we're seeing this user (no prior row).
  prevState: ProjectedEntitlement["entitlement_state"] | null;
  nextState: ProjectedEntitlement["entitlement_state"];
  subscription: ProjectedSubscription | null;
  triggerEventId: string;
};

// Called whenever the projector lands a new state. Idempotent by
// caller — replaying the same event must not double-fire side
// effects. PR 7 enforces this with a (user_id, email_type,
// billing_event_id) unique constraint on the email dispatch table.
export async function onProjectionLanded(
  ctx: SideEffectContext
): Promise<void> {
  const transitioning = ctx.prevState !== ctx.nextState;

  // Activation: user just gained access. Default their notification
  // prefs (instant alerts ON, digest OFF — paying users want
  // immediate signal) and queue a fresh scan if they're already
  // connected. PR 7 will hook the "you're protected" welcome email
  // here.
  if (transitioning && isAccessGranting(ctx.nextState)) {
    if (!isAccessGranting(ctx.prevState)) {
      await onActivation(ctx).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(
          "[billing/side-effects] onActivation failed (non-fatal)",
          ctx.clerkUserId,
          e
        );
      });
    }
  }

  // Access lost: send the right goodbye/pause email depending on
  // which terminal state we landed in.
  if (
    transitioning &&
    !isAccessGranting(ctx.nextState) &&
    isAccessGranting(ctx.prevState)
  ) {
    await onAccessLost(ctx).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(
        "[billing/side-effects] onAccessLost failed (non-fatal)",
        ctx.clerkUserId,
        e
      );
    });
  }

  // active → grace_period: payment failed for the first time. Send
  // the heads-up email immediately. The 72h/T10/T18 reminders fire
  // from the dunning cron once enough time has elapsed.
  if (
    transitioning &&
    ctx.prevState === "active" &&
    ctx.nextState === "grace_period"
  ) {
    await sendBillingEmailSafe(ctx, "payment_declined", ctx.triggerEventId);
  }
}

function isAccessGranting(
  state: ProjectedEntitlement["entitlement_state"] | null
): boolean {
  return (
    state === "trialing" ||
    state === "active" ||
    state === "grace_period" ||
    state === "cancelled_active"
  );
}

// One-time bootstrap for a freshly-activated user. Idempotent —
// running it twice (e.g. webhook replay) produces the same state.
async function onActivation(ctx: SideEffectContext): Promise<void> {
  // 1. Default notification preferences. Paying users want
  //    instant signal: urgent_immediate ON, digest OFF. They can
  //    flip either later via /app/settings.
  await savePreferences(ctx.clerkUserId, {
    email_enabled: true,
    digest_enabled: false,
    urgent_immediate_enabled: true,
  });

  // 2. Welcome email — "You're protected." Dedup'd by subscription
  //    id so reprocessing the same webhook never double-sends.
  await sendBillingEmailSafe(
    ctx,
    "trial_started",
    ctx.subscription?.stripe_subscription_id ?? ctx.triggerEventId
  );

  // 3. Queue a fresh protection scan if the user already connected
  //    a bank. (If they haven't, the next /app visit will route
  //    them to /app/connect anyway.) We don't await the scan — it
  //    can take seconds and we don't want to block webhook
  //    processing on it.
  if (!supabaseAdmin) return;
  const { data: items } = await supabaseAdmin
    .from("plaid_items")
    .select("id")
    .eq("user_id", ctx.clerkUserId)
    .limit(1);

  if (items && items.length > 0) {
    // eslint-disable-next-line no-console
    console.info(
      "[billing/side-effects] user has plaid connection — fresh scan will run on next dashboard load"
    );
    // We deliberately do NOT call runScanForUser here. Scans are
    // best triggered from a user-facing surface where progress can
    // be observed. The dashboard already kicks a scan on first
    // visit; that's enough for activation.
  }
}

// Send the appropriate access-lost email based on terminal state.
async function onAccessLost(ctx: SideEffectContext): Promise<void> {
  const subDedup =
    ctx.subscription?.stripe_subscription_id ?? ctx.triggerEventId;
  if (ctx.nextState === "past_due") {
    // 21-day grace exhausted (or Stripe gave up retrying).
    await sendBillingEmailSafe(ctx, "protection_paused", `${subDedup}:paused`);
    return;
  }
  if (ctx.nextState === "expired") {
    // Cancellation period ended, or subscription.deleted.
    await sendBillingEmailSafe(ctx, "protection_ended", `${subDedup}:ended`);
    return;
  }
  // Any other "lost access" landing — log and move on. We don't
  // send an email rather than risk sending the wrong one.
  // eslint-disable-next-line no-console
  console.info(
    "[billing/side-effects] access lost to unmapped state",
    ctx.nextState
  );
}

// Small wrapper that resolves the user's email from Clerk then
// dispatches via the idempotent sender. Errors are caught and
// logged — billing emails must never crash the projector.
async function sendBillingEmailSafe(
  ctx: SideEffectContext,
  emailType:
    | "trial_started"
    | "payment_declined"
    | "protection_paused"
    | "protection_ended",
  dedupKey: string
): Promise<void> {
  try {
    const user = await clerkClient().users.getUser(ctx.clerkUserId);
    const to =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    if (!to) return;
    await sendBillingEmail({
      clerkUserId: ctx.clerkUserId,
      emailType,
      dedupKey,
      to,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      "[billing/side-effects] sendBillingEmailSafe failed (non-fatal)",
      emailType,
      e
    );
  }
}
