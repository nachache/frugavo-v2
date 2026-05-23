// Projection orchestrator.
//
// Given a clerk user id, this:
//   1. Reads the last N billing_events for them (chronological)
//   2. Runs the pure projector (reduceEvents) to derive state
//   3. Upserts subscriptions_billing + billing_entitlements
//   4. Marks the events as projected
//   5. Invalidates the entitlement cache
//   6. Fires side-effect hooks
//
// All steps are idempotent — replaying produces the same final
// state. If any step partway fails, the next webhook (or a manual
// /admin/billing replay in PR 8) will reproject from scratch and
// fix the divergence.
//
// We read the last 50 events to keep replays bounded. In practice
// even a heavy customer has <30 events across an entire year
// (checkout, monthly renewals, occasional payment failures). 50 is
// generous and cheap.

import { supabaseAdmin } from "@/lib/supabase";
import {
  reduceEvents,
  type BillingEventInput,
  type ProjectionOutput,
} from "@/lib/billing/projector";
import { findClerkUserByStripeCustomer } from "@/lib/billing/customers";
import { invalidateEntitlementCache } from "@/lib/billing/entitlements";
import { onProjectionLanded } from "@/lib/billing/side-effects";

const PROJECTION_WINDOW = 50;

type StoredBillingEvent = {
  id: string;
  event_id: string;
  event_type: string;
  payload: unknown;
  stripe_created_at: string;
  received_at: string;
};

export async function projectByStripeCustomer(args: {
  stripeCustomerId: string;
  triggerEventId: string;
}): Promise<ProjectionOutput | null> {
  const clerkUserId = await findClerkUserByStripeCustomer(
    args.stripeCustomerId
  );
  if (!clerkUserId) {
    // No mapping yet. This can happen if a webhook arrives before
    // our checkout endpoint persisted the stripe_customers row
    // (unlikely but possible on cold start). The reconciler in PR 8
    // backfills these.
    // eslint-disable-next-line no-console
    console.warn(
      "[billing/project] no clerk user for stripe customer",
      args.stripeCustomerId
    );
    return null;
  }
  return projectUserState({
    clerkUserId,
    stripeCustomerId: args.stripeCustomerId,
    triggerEventId: args.triggerEventId,
  });
}

export async function projectUserState(args: {
  clerkUserId: string;
  stripeCustomerId: string;
  triggerEventId: string;
}): Promise<ProjectionOutput> {
  if (!supabaseAdmin) {
    throw new Error("[billing/project] supabaseAdmin not configured");
  }

  // Read prior entitlement so side effects can compare prev → next.
  const { data: priorEnt } = await supabaseAdmin
    .from("billing_entitlements")
    .select("entitlement_state")
    .eq("clerk_user_id", args.clerkUserId)
    .eq("feature", "peace_of_mind")
    .maybeSingle();
  const prevState =
    (priorEnt?.entitlement_state as ProjectionOutput["entitlement"]["entitlement_state"]) ??
    null;

  // Read recent events for this stripe customer, ordered oldest → newest.
  const { data: rows, error: readErr } = await supabaseAdmin
    .from("billing_events")
    .select("id, event_id, event_type, payload, stripe_created_at, received_at")
    .eq("stripe_customer_id", args.stripeCustomerId)
    .order("stripe_created_at", { ascending: true })
    .limit(PROJECTION_WINDOW);

  if (readErr) {
    throw new Error(`[billing/project] event read failed: ${readErr.message}`);
  }
  const events: BillingEventInput[] = (rows ?? []).map(
    (r: StoredBillingEvent) => ({
      event_id: r.event_id,
      event_type: r.event_type,
      payload: r.payload,
      stripe_created_at: r.stripe_created_at,
    })
  );

  // Reduce. Pure function — no side effects.
  const projected = reduceEvents({
    clerkUserId: args.clerkUserId,
    events,
  });

  // Persist subscription projection (audit-side). Skipped if the
  // event stream never produced a subscription (e.g. checkout.session
  // event arrived but subscription.created hasn't yet).
  if (projected.subscription) {
    const sub = projected.subscription;
    const { error: subErr } = await supabaseAdmin
      .from("subscriptions_billing")
      .upsert(
        {
          stripe_subscription_id: sub.stripe_subscription_id,
          stripe_customer_id: sub.stripe_customer_id,
          clerk_user_id: sub.clerk_user_id,
          price_id: sub.price_id,
          stripe_status: sub.stripe_status,
          cancel_at_period_end: sub.cancel_at_period_end,
          trial_start: sub.trial_start,
          trial_end: sub.trial_end,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          canceled_at: sub.canceled_at,
          ended_at: sub.ended_at,
        },
        { onConflict: "stripe_subscription_id" }
      );
    if (subErr) {
      throw new Error(
        `[billing/project] subscriptions_billing upsert failed: ${subErr.message}`
      );
    }
  }

  // Persist entitlement projection (hot path). This is the row the
  // request hot path reads on every gated request.
  const ent = projected.entitlement;
  const { error: entErr } = await supabaseAdmin
    .from("billing_entitlements")
    .upsert(
      {
        clerk_user_id: ent.clerk_user_id,
        feature: ent.feature,
        entitlement_state: ent.entitlement_state,
        stripe_subscription_id: ent.stripe_subscription_id,
        trial_ends_at: ent.trial_ends_at,
        expires_at: ent.expires_at,
        source_event_id: ent.source_event_id,
      },
      { onConflict: "clerk_user_id,feature" }
    );
  if (entErr) {
    throw new Error(
      `[billing/project] billing_entitlements upsert failed: ${entErr.message}`
    );
  }

  // Mark events projected (audit). Best-effort: if it fails the
  // events get reprojected next time, no harm.
  const eventDbIds = (rows ?? []).map((r: StoredBillingEvent) => r.id);
  if (eventDbIds.length > 0) {
    await supabaseAdmin
      .from("billing_events")
      .update({ projected_at: new Date().toISOString() })
      .in("id", eventDbIds);
  }

  // Bust entitlement cache so the next request sees the new state.
  await invalidateEntitlementCache(args.clerkUserId);

  // Fire side effects. Errors here MUST NOT throw — projection
  // already landed and that's the source of truth.
  try {
    await onProjectionLanded({
      clerkUserId: args.clerkUserId,
      prevState,
      nextState: ent.entitlement_state,
      subscription: projected.subscription,
      triggerEventId: args.triggerEventId,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[billing/project] side effect failed (non-fatal)", e);
  }

  return projected;
}
