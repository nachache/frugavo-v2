import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { isBillingAdmin } from "@/lib/billing/admin-gate";
import { supabaseAdmin } from "@/lib/supabase";
import { projectUserState } from "@/lib/billing/project";

// POST /api/admin/billing/replay
//
// Body: { clerk_user_id: string }
//
// Re-runs the projector for the given user from their full
// billing_events log. Used by the admin billing dashboard's
// per-row "Replay" button. Admin-gated by FRUGAVO_ADMIN_USER_IDS.

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = { clerk_user_id?: string };

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isBillingAdmin(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const clerkUserId = body.clerk_user_id;
  if (!clerkUserId) {
    return NextResponse.json(
      { error: "missing_clerk_user_id" },
      { status: 400 }
    );
  }

  // Find the user's Stripe customer id via stripe_customers.
  const { data: customer } = await supabaseAdmin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json(
      { error: "no_stripe_customer_for_user" },
      { status: 404 }
    );
  }

  try {
    const projected = await projectUserState({
      clerkUserId,
      stripeCustomerId: customer.stripe_customer_id,
      triggerEventId: `admin_replay:${new Date().toISOString()}`,
    });
    return NextResponse.json({
      ok: true,
      entitlement_state: projected.entitlement.entitlement_state,
      stripe_subscription_id: projected.entitlement.stripe_subscription_id,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[admin/billing/replay] failed", e);
    return NextResponse.json(
      { error: "replay_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
