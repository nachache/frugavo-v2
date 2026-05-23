// Side-effect hooks fired by the projector after a state change lands.
//
// PR 4 ships these as no-op stubs so the projection pipeline is
// complete end-to-end. Real implementations:
//   - onActivation (PR 5): queue first protection scan, default
//     notification preferences, log welcome
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

  // Activation: user just gained access. PR 5 will queue a first
  // scan, default notification prefs, log welcome.
  if (transitioning && isAccessGranting(ctx.nextState)) {
    if (!isAccessGranting(ctx.prevState)) {
      // PR 5 wires the real implementation. Stub for now so the
      // pipeline doesn't break the moment a real trial starts.
      // eslint-disable-next-line no-console
      console.info(
        "[billing/side-effects] activation TODO (PR 5)",
        ctx.clerkUserId,
        ctx.nextState
      );
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
