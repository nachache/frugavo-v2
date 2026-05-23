// Reconciler — keeps Stripe and our local projection in sync.
//
// Why: webhooks are unreliable (late delivery, dropped, never
// delivered). Even with 99.9% delivery, a long-tail of customers
// will end up with stale local state. The reconciler is the
// safety net: a daily sweep that:
//
//   1. Lists every Stripe Subscription in our test/live account
//      that's currently active/trialing/past_due/unpaid.
//   2. Joins to local subscriptions_billing on stripe_subscription_id.
//   3. Flags mismatches:
//        - Stripe has it, local doesn't (missing projection)
//        - Local says active, Stripe says canceled (stale projection)
//        - stripe_status differs
//   4. For each mismatch, re-projects from billing_events. If still
//      mismatched after replay, surfaces it in the admin dashboard.
//
// We never auto-mutate based on Stripe alone — the projector is the
// only writer. The reconciler triggers a replay, which is just a
// re-run of the same pure function. If a webhook truly never
// arrived, the replay won't fix it — the admin sees the divergence
// and can manually trigger Stripe to resend.

import { getStripe } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { projectByStripeCustomer } from "@/lib/billing/project";

export type ReconcileMismatch = {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_status: string;
  local_status: string | null;
  local_exists: boolean;
  kind: "missing_local" | "status_differs" | "missing_stripe";
};

export type ReconcileResult = {
  ok: boolean;
  scanned_stripe: number;
  scanned_local: number;
  mismatches_before_replay: number;
  mismatches_after_replay: number;
  replays_attempted: number;
  unresolved: ReconcileMismatch[];
};

const STATUSES_OF_INTEREST = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
] as const;

export async function runReconciliation(): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    ok: false,
    scanned_stripe: 0,
    scanned_local: 0,
    mismatches_before_replay: 0,
    mismatches_after_replay: 0,
    replays_attempted: 0,
    unresolved: [],
  };

  if (!supabaseAdmin) return result;

  const stripe = getStripe();

  // Stripe Subscription list is paginated; loop until we have all
  // statuses-of-interest. Auto-pagination via the SDK.
  const stripeSubs: {
    id: string;
    customer: string;
    status: string;
  }[] = [];

  for (const status of STATUSES_OF_INTEREST) {
    for await (const sub of stripe.subscriptions.list({
      status,
      limit: 100,
    })) {
      stripeSubs.push({
        id: sub.id,
        customer:
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        status: sub.status,
      });
    }
  }
  result.scanned_stripe = stripeSubs.length;

  // Pull every local row in those statuses too — so we can spot the
  // reverse case (local thinks active, Stripe says canceled).
  const { data: localRows } = await supabaseAdmin
    .from("subscriptions_billing")
    .select("stripe_subscription_id, stripe_customer_id, stripe_status")
    .in("stripe_status", STATUSES_OF_INTEREST as unknown as string[]);

  const localById = new Map<
    string,
    { stripe_customer_id: string; stripe_status: string }
  >();
  for (const r of localRows ?? []) {
    localById.set(r.stripe_subscription_id, {
      stripe_customer_id: r.stripe_customer_id,
      stripe_status: r.stripe_status,
    });
  }
  result.scanned_local = localById.size;

  // First pass: spot mismatches.
  const mismatches: ReconcileMismatch[] = [];
  const stripeIds = new Set<string>();
  for (const s of stripeSubs) {
    stripeIds.add(s.id);
    const local = localById.get(s.id);
    if (!local) {
      mismatches.push({
        stripe_subscription_id: s.id,
        stripe_customer_id: s.customer,
        stripe_status: s.status,
        local_status: null,
        local_exists: false,
        kind: "missing_local",
      });
      continue;
    }
    if (local.stripe_status !== s.status) {
      mismatches.push({
        stripe_subscription_id: s.id,
        stripe_customer_id: s.customer,
        stripe_status: s.status,
        local_status: local.stripe_status,
        local_exists: true,
        kind: "status_differs",
      });
    }
  }

  // Reverse case: local thinks active/trialing but Stripe doesn't
  // list it anywhere in our statuses-of-interest. Likely Stripe
  // canceled it without a webhook arriving.
  for (const [subId, local] of localById) {
    if (!stripeIds.has(subId)) {
      mismatches.push({
        stripe_subscription_id: subId,
        stripe_customer_id: local.stripe_customer_id,
        stripe_status: "(not_in_stripe_active_list)",
        local_status: local.stripe_status,
        local_exists: true,
        kind: "missing_stripe",
      });
    }
  }

  result.mismatches_before_replay = mismatches.length;

  // Second pass: replay projection per mismatched customer. The
  // projector reads ALL events for the customer and re-derives
  // state, so this is enough to fix the common case (webhook
  // arrived but projection silently failed).
  const replayedCustomers = new Set<string>();
  for (const m of mismatches) {
    if (replayedCustomers.has(m.stripe_customer_id)) continue;
    replayedCustomers.add(m.stripe_customer_id);
    result.replays_attempted++;
    try {
      await projectByStripeCustomer({
        stripeCustomerId: m.stripe_customer_id,
        triggerEventId: `reconcile:${new Date().toISOString().slice(0, 10)}`,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        "[billing/reconciler] replay failed for customer",
        m.stripe_customer_id,
        e
      );
    }
  }

  // Third pass: re-check by reading local again and comparing.
  const { data: postRows } = await supabaseAdmin
    .from("subscriptions_billing")
    .select("stripe_subscription_id, stripe_status")
    .in("stripe_subscription_id", mismatches.map((m) => m.stripe_subscription_id));
  const postById = new Map<string, string>();
  for (const r of postRows ?? []) {
    postById.set(r.stripe_subscription_id, r.stripe_status);
  }

  for (const m of mismatches) {
    const post = postById.get(m.stripe_subscription_id) ?? null;
    if (m.kind === "missing_local" && post) continue; // resolved
    if (m.kind === "status_differs" && post === m.stripe_status) continue;
    if (m.kind === "missing_stripe" && (!post || post === "canceled")) continue;
    result.unresolved.push({ ...m, local_status: post });
  }
  result.mismatches_after_replay = result.unresolved.length;

  result.ok = true;
  return result;
}
