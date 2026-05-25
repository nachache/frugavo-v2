// Pure event → state reducer.
//
// Given the chronological list of billing_events for a single
// (clerk_user_id, feature), produce the projected:
//   - subscriptions_billing row (or null if user never checked out)
//   - billing_entitlements row
//
// Pure function: same inputs → same outputs, no side effects, no DB
// reads, no Stripe calls. This is the disaster-recovery promise —
// re-running the projector over the raw billing_events log should
// reproduce the current state exactly. If projection logic ever has
// a bug, we fix the function and replay.
//
// PR 4 wires this into the webhook handler: persist event → call
// projector over last N events → transact the result into the
// projection tables.
//
// State machine (entitlement_state):
//
//   none ──checkout.completed (trial)──→ trialing
//   none ──checkout.completed (no trial)→ active
//   trialing ──invoice.payment_succeeded→ active
//   trialing ──trial end + payment fail→ past_due
//   active ──invoice.payment_failed────→ grace_period
//   grace_period ──invoice.payment_succeeded→ active
//   grace_period ──21d elapsed─────────→ past_due
//   active ──subscription.updated cancel_at_period_end→ cancelled_active
//   cancelled_active ──period_end reached→ expired
//   any ──subscription.deleted─────────→ expired

import type Stripe from "stripe";
import type { EntitlementState } from "@/lib/billing/entitlements";

// Grace period before access is cut off after a payment failure.
// 21 days, with monitoring paused at day 14 (handled in PR 7).
const GRACE_PERIOD_DAYS = 21;

export type ProjectedSubscription = {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  clerk_user_id: string;
  price_id: string;
  stripe_status: string;
  cancel_at_period_end: boolean;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  ended_at: string | null;
};

export type ProjectedEntitlement = {
  clerk_user_id: string;
  feature: string;
  entitlement_state: EntitlementState;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  expires_at: string | null;
  source_event_id: string | null;
};

export type ProjectionInput = {
  clerkUserId: string;
  feature?: string; // defaults to peace_of_mind
  // Events ordered oldest → newest. The reducer trusts the order;
  // sorting happens at the caller (PR 4) using event.created.
  events: ReadonlyArray<BillingEventInput>;
};

export type BillingEventInput = {
  event_id: string;
  event_type: string;
  // The full Stripe object the event references (event.data.object).
  // Typed loosely as `unknown` because we narrow per event_type
  // inside the reducer.
  payload: unknown;
  // Time the event happened in Stripe, ISO string. Used to compute
  // expires_at for grace period.
  stripe_created_at: string;
};

export type ProjectionOutput = {
  subscription: ProjectedSubscription | null;
  entitlement: ProjectedEntitlement;
};

// Coerce a Stripe unix-seconds timestamp (number | null) to an ISO
// string suitable for timestamptz columns.
function tsToIso(unixSec: number | null | undefined): string | null {
  if (unixSec === null || unixSec === undefined) return null;
  return new Date(unixSec * 1000).toISOString();
}

function isSubscription(obj: unknown): obj is Stripe.Subscription {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (obj as Stripe.Subscription).object === "subscription"
  );
}

function isInvoice(obj: unknown): obj is Stripe.Invoice {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (obj as Stripe.Invoice).object === "invoice"
  );
}

function isCheckoutSession(obj: unknown): obj is Stripe.Checkout.Session {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (obj as Stripe.Checkout.Session).object === "checkout.session"
  );
}

// Derive entitlement state from a (possibly updated) Stripe
// Subscription. Pure mapping — no "now()" reads, no time-based
// downgrades. The projector returns the state as derived from the
// event log alone, so replaying produces deterministic output.
//
// Stripe status → our state:
//   trialing               → trialing
//   active                 → active (or cancelled_active if
//                            cancel_at_period_end)
//   past_due               → grace_period (Stripe is still retrying)
//   unpaid                 → past_due (Stripe gave up, dunning done)
//   canceled               → expired
//   incomplete_expired     → expired
//   incomplete             → none (first payment hasn't cleared yet)
//
// The grace_period → past_due transition by elapsed time is the
// reconciler cron's job (PR 8). hasAccess in the read path also
// treats grace_period as "no access" once now > expires_at, so
// access cutoff is correct even if the cron hasn't yet swept the
// row.
function stateFromSubscription(
  sub: Stripe.Subscription,
  paymentFailedAtIso: string | null
): {
  state: EntitlementState;
  expiresAt: string | null;
  trialEndsAt: string | null;
} {
  const trialEnd = tsToIso(sub.trial_end);
  // SDK 2026-04-22.dahlia moved current_period_start / current_period_end
  // from the Subscription to each Subscription Item. Frugavo has a single
  // price per sub, so the first item's period IS the sub's period.
  const periodEnd = tsToIso(sub.items.data[0]?.current_period_end ?? null);

  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    return { state: "expired", expiresAt: null, trialEndsAt: trialEnd };
  }
  if (sub.cancel_at_period_end) {
    return {
      state: "cancelled_active",
      expiresAt: periodEnd,
      trialEndsAt: trialEnd,
    };
  }
  if (sub.status === "unpaid") {
    // Stripe exhausted its retry schedule. Our 21-day grace is over.
    return { state: "past_due", expiresAt: null, trialEndsAt: trialEnd };
  }
  if (sub.status === "past_due") {
    // Map to our 21-day grace window. expires_at anchors on the
    // first failure timestamp from the event log, not "now", so
    // replaying produces the same answer.
    const baseIso =
      paymentFailedAtIso ??
      tsToIso(sub.items.data[0]?.current_period_end ?? null);
    const expires = baseIso
      ? new Date(
          new Date(baseIso).getTime() + GRACE_PERIOD_DAYS * 86400_000
        ).toISOString()
      : null;
    return { state: "grace_period", expiresAt: expires, trialEndsAt: trialEnd };
  }
  if (sub.status === "trialing") {
    return { state: "trialing", expiresAt: null, trialEndsAt: trialEnd };
  }
  if (sub.status === "active") {
    return { state: "active", expiresAt: null, trialEndsAt: trialEnd };
  }
  // incomplete: Stripe hasn't confirmed the first payment yet.
  // We treat it as none so the dashboard doesn't flash "protected"
  // before the card actually charged.
  return { state: "none", expiresAt: null, trialEndsAt: trialEnd };
}

function subscriptionToRow(
  sub: Stripe.Subscription,
  clerkUserId: string
): ProjectedSubscription {
  const priceId = sub.items.data[0]?.price.id ?? "unknown";
  return {
    stripe_subscription_id: sub.id,
    stripe_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    clerk_user_id: clerkUserId,
    price_id: priceId,
    stripe_status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_start: tsToIso(sub.trial_start),
    trial_end: tsToIso(sub.trial_end),
    current_period_start: tsToIso(
      sub.items.data[0]?.current_period_start ?? null
    ),
    current_period_end: tsToIso(
      sub.items.data[0]?.current_period_end ?? null
    ),
    canceled_at: tsToIso(sub.canceled_at),
    ended_at: tsToIso(sub.ended_at),
  };
}

export function reduceEvents(input: ProjectionInput): ProjectionOutput {
  const { clerkUserId, events } = input;
  const feature = input.feature ?? "peace_of_mind";

  let subscription: ProjectedSubscription | null = null;
  let entitlement: ProjectedEntitlement = {
    clerk_user_id: clerkUserId,
    feature,
    entitlement_state: "none",
    stripe_subscription_id: null,
    trial_ends_at: null,
    expires_at: null,
    source_event_id: null,
  };

  // We track the most recent payment failure time across events so
  // grace_period can anchor its 21-day clock without "now()".
  let lastPaymentFailedIso: string | null = null;

  for (const evt of events) {
    const { event_id, event_type, payload, stripe_created_at } = evt;

    if (event_type === "checkout.session.completed") {
      if (!isCheckoutSession(payload)) continue;
      // Checkout's main signal: the customer paid (or started trial).
      // The actual subscription state arrives via the
      // customer.subscription.created event that fires alongside.
      // We just remember that something happened.
      entitlement = {
        ...entitlement,
        source_event_id: event_id,
      };
      continue;
    }

    if (
      event_type === "customer.subscription.created" ||
      event_type === "customer.subscription.updated"
    ) {
      if (!isSubscription(payload)) continue;
      subscription = subscriptionToRow(payload, clerkUserId);
      const derived = stateFromSubscription(payload, lastPaymentFailedIso);
      entitlement = {
        clerk_user_id: clerkUserId,
        feature,
        entitlement_state: derived.state,
        stripe_subscription_id: payload.id,
        trial_ends_at: derived.trialEndsAt,
        expires_at: derived.expiresAt,
        source_event_id: event_id,
      };
      continue;
    }

    if (event_type === "customer.subscription.deleted") {
      if (!isSubscription(payload)) continue;
      subscription = subscriptionToRow(payload, clerkUserId);
      entitlement = {
        clerk_user_id: clerkUserId,
        feature,
        entitlement_state: "expired",
        stripe_subscription_id: payload.id,
        trial_ends_at: tsToIso(payload.trial_end),
        expires_at: null,
        source_event_id: event_id,
      };
      continue;
    }

    if (event_type === "invoice.payment_succeeded") {
      if (!isInvoice(payload)) continue;
      // If we were in grace_period, lift back to active. If we were
      // trialing and this is the first paid invoice, transition to
      // active. Subscription state from the paired subscription.updated
      // event is authoritative — we just clear our grace anchor.
      lastPaymentFailedIso = null;
      // Don't overwrite entitlement_state here — the paired
      // subscription.updated event will handle that. Just stamp
      // source_event_id so the audit trail is complete.
      entitlement = { ...entitlement, source_event_id: event_id };
      continue;
    }

    if (event_type === "invoice.payment_failed") {
      if (!isInvoice(payload)) continue;
      lastPaymentFailedIso = stripe_created_at;
      // The paired subscription.updated will move stripe status to
      // past_due, which our stateFromSubscription maps to
      // grace_period using lastPaymentFailedIso.
      entitlement = { ...entitlement, source_event_id: event_id };
      continue;
    }

    // Unknown event_type — ignored. The raw row stays in
    // billing_events for future replay if logic changes.
  }

  return { subscription, entitlement };
}
