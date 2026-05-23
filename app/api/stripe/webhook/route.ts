import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getStripe, stripeWebhookSecret } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { tryAcquireLock } from "@/lib/cache";
import { projectByStripeCustomer } from "@/lib/billing/project";
import type Stripe from "stripe";

// POST /api/stripe/webhook
//
// Receives every webhook Stripe sends. Six-stage pipeline per the
// build doc:
//
//   1. Signature verification (Stripe SDK)
//   2. Idempotency check (Redis dedupe, 7d TTL, keyed on event.id)
//   3. Durable persistence (insert billing_events with ON CONFLICT)
//   4. Return 200 to Stripe within 100ms (well within 30s timeout)
//   5. Projection: reduceEvents → upsert subscription + entitlement
//   6. Cache bust + side effects
//
// Why we project inline (steps 5-6) rather than fire-and-forget:
// Netlify Functions kill non-awaited Promises after response,
// so a true async approach needs a queue or background function.
// In practice projection takes ~150ms (one event read, two upserts,
// one cache delete), and Stripe is patient up to 30s. We prefer
// the simplicity until queue infrastructure becomes worth it.
//
// IMPORTANT: this route must read the RAW body (not parsed JSON)
// for signature verification. Next.js App Router gives us
// `await req.text()` for this, which preserves bytes exactly.

export const runtime = "nodejs";
export const maxDuration = 30; // Stripe's webhook timeout

// Events we care about. Anything else lands in billing_events for
// audit but doesn't trigger projection — keeps replay focused on
// the events that actually change state.
const PROJECTABLE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

export async function POST(req: NextRequest) {
  // Read raw body BEFORE doing anything else. Stripe signs the
  // exact bytes; parsing to JSON first would let through tampered
  // payloads whose signature happens to verify against the
  // un-tampered string.
  const rawBody = await req.text();
  const sig = headers().get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // ---- 1. Signature verification ----
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      stripeWebhookSecret()
    );
  } catch (e) {
    // Don't leak detail — could help an attacker calibrate.
    // eslint-disable-next-line no-console
    console.error(
      "[stripe/webhook] signature verification failed",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // ---- 2. Idempotency check (Redis) ----
  // Stripe retries on any non-2xx for up to 3 days. The lock
  // returns false on the second arrival, so we ack 200 immediately
  // without re-doing work.
  const lockKey = `billing:webhook:dedupe:${event.id}`;
  const fresh = await tryAcquireLock(lockKey, 7 * 86400); // 7 days
  if (!fresh) {
    // Already processed (or in flight). Ack and move on.
    return NextResponse.json({ received: true, deduped: true });
  }

  // ---- 3. Durable persistence ----
  // Insert into billing_events. The unique constraint on event_id
  // is a belt-and-braces dedupe — if Redis evicted the lock key
  // somehow, the DB still rejects duplicates.
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  }

  const stripeCustomerId = extractStripeCustomerId(event);
  const stripeCreatedAtIso = new Date(event.created * 1000).toISOString();

  const { error: insertErr } = await supabaseAdmin.from("billing_events").insert({
    event_id: event.id,
    event_type: event.type,
    stripe_customer_id: stripeCustomerId,
    payload: event.data.object,
    api_version: event.api_version,
    livemode: event.livemode,
    // Use Stripe's created timestamp as our event time so the
    // projector orders events the same way Stripe did.
    received_at: stripeCreatedAtIso,
  });

  if (insertErr && !isUniqueViolation(insertErr)) {
    // eslint-disable-next-line no-console
    console.error("[stripe/webhook] insert failed", insertErr);
    return NextResponse.json({ error: "persist_failed" }, { status: 500 });
  }

  // ---- 5. Projection (inline, see top-of-file note) ----
  if (
    stripeCustomerId &&
    PROJECTABLE_EVENT_TYPES.has(event.type)
  ) {
    try {
      await projectByStripeCustomer({
        stripeCustomerId,
        triggerEventId: event.id,
      });
    } catch (e) {
      // Log but don't 500 — the event is durably in billing_events
      // and the reconciler (PR 8) will re-project.
      // eslint-disable-next-line no-console
      console.error(
        "[stripe/webhook] projection failed (will retry via reconciler)",
        event.id,
        e
      );
    }
  }

  // ---- 4. Ack ----
  return NextResponse.json({ received: true });
}

// Pull the Stripe Customer id off whichever event-object shape we
// just received. Some events nest it (invoice → customer), some
// have it at top level (subscription.customer). Returns null for
// event types that don't reference a customer at all.
function extractStripeCustomerId(event: Stripe.Event): string | null {
  const obj = event.data.object as Record<string, unknown>;
  if (!obj) return null;

  const direct = obj.customer;
  if (typeof direct === "string") return direct;
  if (
    direct &&
    typeof direct === "object" &&
    "id" in direct &&
    typeof (direct as { id: unknown }).id === "string"
  ) {
    return (direct as { id: string }).id;
  }

  // checkout.session has customer at top level too (above) but
  // sometimes only client_reference_id — those are still useful
  // for projection via stripe_customers reverse-lookup.
  return null;
}

function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  // Postgres unique-violation SQLSTATE
  if (err.code === "23505") return true;
  if (err.message && /duplicate key value violates unique/i.test(err.message)) {
    return true;
  }
  return false;
}
