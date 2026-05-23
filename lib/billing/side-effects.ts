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

  // Cancellation: user just lost access (or scheduled to). PR 7
  // will send the "we'll miss you" / "your protection paused" emails.
  if (
    transitioning &&
    !isAccessGranting(ctx.nextState) &&
    isAccessGranting(ctx.prevState)
  ) {
    // eslint-disable-next-line no-console
    console.info(
      "[billing/side-effects] access lost TODO (PR 7)",
      ctx.clerkUserId,
      ctx.nextState
    );
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

  // 2. PR 7 will trigger the "You're protected" welcome email here.
  //    Logging it now so the audit trail shows where it'll land.
  // eslint-disable-next-line no-console
  console.info(
    "[billing/side-effects] activation complete",
    {
      userId: ctx.clerkUserId,
      state: ctx.nextState,
      triggerEventId: ctx.triggerEventId,
      welcomeEmailPending: "PR 7",
    }
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
