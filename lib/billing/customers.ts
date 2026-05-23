// Clerk user → Stripe Customer mapping.
//
// We do NOT auto-create a Stripe Customer for every Clerk signup —
// that would pollute the Stripe dashboard with millions of unused
// customer records. Customers are created lazily on first checkout.
//
// Concurrency: two parallel checkout calls from the same user must
// not produce two Stripe Customers. We protect against this with:
//   1. A Redis SETNX lock (10s) around the create call
//   2. A unique constraint on stripe_customers.clerk_user_id
//
// If lock acquisition fails (Redis unavailable) we still write to
// Postgres with an upsert and let the unique constraint be the
// source of truth. The lock is an optimization, not a correctness
// requirement.

import { supabaseAdmin } from "@/lib/supabase";
import { tryAcquireLock } from "@/lib/cache";
import { getStripe } from "@/lib/billing/stripe";

const LOCK_TTL_SECONDS = 10;

export type StripeCustomerRow = {
  clerk_user_id: string;
  stripe_customer_id: string;
  email: string | null;
};

export async function getStripeCustomerId(
  clerkUserId: string
): Promise<string | null> {
  if (!supabaseAdmin) {
    throw new Error("[billing] supabaseAdmin not configured");
  }
  const { data, error } = await supabaseAdmin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (error) {
    throw new Error(`[billing] getStripeCustomerId failed: ${error.message}`);
  }
  return data?.stripe_customer_id ?? null;
}

// Get the Stripe Customer for a Clerk user, creating one if needed.
// Idempotent across concurrent callers.
//
// `email` is optional — Clerk provides it from `currentUser()`, and
// we pass it so Stripe Receipts and Dashboard searches work nicely.
// We can be wrong about it (user changes email later) and Stripe
// handles updates via the customer.updated event.
export async function getOrCreateStripeCustomer(args: {
  clerkUserId: string;
  email?: string | null;
}): Promise<string> {
  const { clerkUserId, email } = args;
  if (!supabaseAdmin) {
    throw new Error("[billing] supabaseAdmin not configured");
  }

  // Fast path: existing mapping.
  const existing = await getStripeCustomerId(clerkUserId);
  if (existing) return existing;

  // Slow path: need to create. Take a lock so concurrent callers
  // don't create duplicate Stripe Customers.
  const lockKey = `lock:billing:create-customer:${clerkUserId}`;
  const gotLock = await tryAcquireLock(lockKey, LOCK_TTL_SECONDS);

  if (!gotLock) {
    // Another caller is creating; wait briefly and re-read. We don't
    // implement a sophisticated wait — the lock holder usually finishes
    // in <500ms, and a slightly stale read here just means the next
    // request will succeed.
    await new Promise((r) => setTimeout(r, 500));
    const again = await getStripeCustomerId(clerkUserId);
    if (again) return again;
    // Lock holder may have failed. Fall through and try ourselves.
  }

  // Create in Stripe first, then mirror in Postgres. Order matters:
  // if Stripe succeeds but Postgres write fails, we orphan a Stripe
  // Customer (harmless, free, easily reconciled). If we did the
  // reverse, we'd have a Postgres row pointing at a Customer that
  // doesn't exist.
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      clerk_user_id: clerkUserId,
      source: "frugavo",
    },
  });

  // Upsert with ON CONFLICT — if a concurrent caller raced us past
  // the lock and won, their row stays; ours is silently dropped.
  const { error: upsertError } = await supabaseAdmin
    .from("stripe_customers")
    .upsert(
      {
        clerk_user_id: clerkUserId,
        stripe_customer_id: customer.id,
        email: email ?? null,
      },
      { onConflict: "clerk_user_id", ignoreDuplicates: true }
    );
  if (upsertError) {
    throw new Error(
      `[billing] failed to persist stripe_customers row: ${upsertError.message}`
    );
  }

  // If a concurrent caller won the race, the row in Postgres now
  // points to their Stripe Customer, not ours. Re-read to be sure
  // we return the canonical one.
  const final = await getStripeCustomerId(clerkUserId);
  return final ?? customer.id;
}

// Reverse lookup: given a Stripe Customer id from a webhook, find
// the Clerk user. Used by the webhook handler to attribute events
// to the right user even when Stripe didn't include client_reference_id.
export async function findClerkUserByStripeCustomer(
  stripeCustomerId: string
): Promise<string | null> {
  if (!supabaseAdmin) {
    throw new Error("[billing] supabaseAdmin not configured");
  }
  const { data, error } = await supabaseAdmin
    .from("stripe_customers")
    .select("clerk_user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `[billing] findClerkUserByStripeCustomer failed: ${error.message}`
    );
  }
  return data?.clerk_user_id ?? null;
}
