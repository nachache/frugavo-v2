import { describe, expect, it } from "vitest";
import { reduceEvents, type BillingEventInput } from "@/lib/billing/projector";

// The projector is the disaster-recovery promise: given the raw
// billing_events log we can re-derive subscription + entitlement
// state deterministically. These tests pin the state machine so
// regressions are loud.

const USER = "user_test_123";
const CUSTOMER = "cus_test_abc";
const SUB = "sub_test_xyz";
const PRICE = "price_test_peace_of_mind";

// Helper: build a minimal but valid Stripe.Subscription-shaped object.
function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    object: "subscription",
    id: SUB,
    customer: CUSTOMER,
    status: "active",
    cancel_at_period_end: false,
    trial_start: null,
    trial_end: null,
    current_period_start: 1700000000,
    current_period_end: 1702592000,
    canceled_at: null,
    ended_at: null,
    items: { data: [{ price: { id: PRICE } }] },
    ...overrides,
  };
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    object: "invoice",
    id: "in_test",
    customer: CUSTOMER,
    subscription: SUB,
    ...overrides,
  };
}

function event(
  type: string,
  payload: unknown,
  isoTime = "2024-01-01T00:00:00Z"
): BillingEventInput {
  return {
    event_id: `evt_${type}_${Math.random().toString(36).slice(2, 8)}`,
    event_type: type,
    payload,
    stripe_created_at: isoTime,
  };
}

describe("billing projector", () => {
  it("starts at 'none' with no events", () => {
    const out = reduceEvents({ clerkUserId: USER, events: [] });
    expect(out.subscription).toBeNull();
    expect(out.entitlement.entitlement_state).toBe("none");
    expect(out.entitlement.stripe_subscription_id).toBeNull();
  });

  it("transitions to trialing on subscription.created with trial", () => {
    const sub = makeSub({
      status: "trialing",
      trial_start: 1700000000,
      trial_end: 1700604800, // 7 days later
    });
    const out = reduceEvents({
      clerkUserId: USER,
      events: [event("customer.subscription.created", sub)],
    });
    expect(out.entitlement.entitlement_state).toBe("trialing");
    expect(out.entitlement.stripe_subscription_id).toBe(SUB);
    expect(out.entitlement.trial_ends_at).toBe(
      new Date(1700604800 * 1000).toISOString()
    );
    expect(out.subscription?.price_id).toBe(PRICE);
  });

  it("transitions trialing → active on subscription.updated active", () => {
    const out = reduceEvents({
      clerkUserId: USER,
      events: [
        event(
          "customer.subscription.created",
          makeSub({ status: "trialing", trial_end: 1700604800 })
        ),
        event("invoice.payment_succeeded", makeInvoice()),
        event(
          "customer.subscription.updated",
          makeSub({ status: "active" })
        ),
      ],
    });
    expect(out.entitlement.entitlement_state).toBe("active");
  });

  it("transitions active → grace_period on payment failure", () => {
    const out = reduceEvents({
      clerkUserId: USER,
      events: [
        event(
          "customer.subscription.created",
          makeSub({ status: "active" })
        ),
        event(
          "invoice.payment_failed",
          makeInvoice(),
          "2024-06-01T00:00:00Z"
        ),
        event(
          "customer.subscription.updated",
          makeSub({ status: "past_due" })
        ),
      ],
    });
    expect(out.entitlement.entitlement_state).toBe("grace_period");
    // 21 days after the 2024-06-01 failure → 2024-06-22
    expect(out.entitlement.expires_at).toBe("2024-06-22T00:00:00.000Z");
  });

  it("transitions grace_period → active on payment recovery", () => {
    const out = reduceEvents({
      clerkUserId: USER,
      events: [
        event(
          "customer.subscription.created",
          makeSub({ status: "active" })
        ),
        event(
          "invoice.payment_failed",
          makeInvoice(),
          "2024-06-01T00:00:00Z"
        ),
        event(
          "customer.subscription.updated",
          makeSub({ status: "past_due" })
        ),
        event(
          "invoice.payment_succeeded",
          makeInvoice(),
          "2024-06-03T00:00:00Z"
        ),
        event(
          "customer.subscription.updated",
          makeSub({ status: "active" })
        ),
      ],
    });
    expect(out.entitlement.entitlement_state).toBe("active");
    expect(out.entitlement.expires_at).toBeNull();
  });

  it("transitions active → cancelled_active when cancel_at_period_end flips", () => {
    const periodEnd = 1735689600; // 2025-01-01
    const out = reduceEvents({
      clerkUserId: USER,
      events: [
        event(
          "customer.subscription.created",
          makeSub({ status: "active", current_period_end: periodEnd })
        ),
        event(
          "customer.subscription.updated",
          makeSub({
            status: "active",
            cancel_at_period_end: true,
            current_period_end: periodEnd,
          })
        ),
      ],
    });
    expect(out.entitlement.entitlement_state).toBe("cancelled_active");
    expect(out.entitlement.expires_at).toBe(
      new Date(periodEnd * 1000).toISOString()
    );
  });

  it("transitions to expired on subscription.deleted", () => {
    const out = reduceEvents({
      clerkUserId: USER,
      events: [
        event(
          "customer.subscription.created",
          makeSub({ status: "active" })
        ),
        event(
          "customer.subscription.deleted",
          makeSub({ status: "canceled" })
        ),
      ],
    });
    expect(out.entitlement.entitlement_state).toBe("expired");
  });

  it("replay determinism: same events in same order produce same output", () => {
    const events = [
      event(
        "customer.subscription.created",
        makeSub({ status: "trialing", trial_end: 1700604800 })
      ),
      event("invoice.payment_succeeded", makeInvoice()),
      event(
        "customer.subscription.updated",
        makeSub({ status: "active" })
      ),
    ];
    const a = reduceEvents({ clerkUserId: USER, events });
    const b = reduceEvents({ clerkUserId: USER, events });
    expect(a).toEqual(b);
  });

  it("ignores unknown event types but stamps source_event_id from known events", () => {
    const out = reduceEvents({
      clerkUserId: USER,
      events: [
        event("unknown.event.type", {}),
        event(
          "customer.subscription.created",
          makeSub({ status: "active" })
        ),
        event("another.unknown", {}),
      ],
    });
    expect(out.entitlement.entitlement_state).toBe("active");
    expect(out.entitlement.source_event_id).toContain(
      "evt_customer.subscription.created"
    );
  });
});
