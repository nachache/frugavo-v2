import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken } from "@/lib/crypto";
import { getStripe } from "@/lib/billing/stripe";

// POST /api/account/delete
//
// Hard-deletes the user's data:
//
//   Stripe side
//     1. Cancel any active Stripe subscription immediately (refunds
//        unused time pro-rata depending on Dashboard settings).
//
//   Plaid side
//     2. Revoke every Plaid access token they have via /item/remove.
//
//   Supabase side
//     3. Delete every row in every per-user table:
//        - subscription_charges, cancellations, subscriptions
//        - scan_runs, scan_snapshots, plaid_transactions
//        - ai_calls, monitoring_alerts
//        - feedback_events, user_overrides, user_preferences
//        - stripe_customers, subscriptions_billing, billing_events,
//          billing_entitlements, payment_methods_mirror,
//          billing_email_dispatches
//        - plaid_items, app_users
//
// Clerk identity is NOT deleted here — the user signs in via Clerk and
// can delete the Clerk account themselves through Clerk's account
// portal. We only own the data inside Supabase + the connected
// third-party state (Stripe subs, Plaid tokens).
//
// Order matters for FK safety: children before parents, dependent
// mirrors before the source-of-truth row.
//
// All third-party calls swallow errors so a Stripe or Plaid hiccup
// can't trap the user with un-deleted local data.
//
// Body: { confirm: "DELETE" }  — guard against accidental client calls.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: { confirm?: string };
  try {
    body = (await req.json()) as { confirm?: string };
  } catch {
    body = {};
  }
  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: "Confirmation phrase required" },
      { status: 400 }
    );
  }

  // ── Stripe: cancel active subscriptions ─────────────────────────
  // Wrapped in try so a Stripe outage doesn't block the local wipe.
  try {
    const { data: subs } = await supabaseAdmin
      .from("subscriptions_billing")
      .select("stripe_subscription_id, status")
      .eq("user_id", user.id);

    if (subs && subs.length > 0) {
      const stripe = getStripe();
      for (const s of subs) {
        if (!s.stripe_subscription_id) continue;
        // Cancel cancelled/incomplete subs is a no-op for Stripe but
        // they return an error. We skip those defensively.
        if (
          s.status === "canceled" ||
          s.status === "incomplete_expired"
        ) {
          continue;
        }
        try {
          await stripe.subscriptions.cancel(s.stripe_subscription_id, {
            invoice_now: false,
            prorate: false,
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(
            "[account/delete] stripe cancel failed",
            s.stripe_subscription_id,
            e
          );
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[account/delete] stripe path failed", e);
  }

  // ── Plaid: revoke every access token ────────────────────────────
  const { data: items } = await supabaseAdmin
    .from("plaid_items")
    .select("plaid_access_token")
    .eq("user_id", user.id);

  if (items && plaidClient) {
    for (const it of items) {
      if (!it.plaid_access_token || it.plaid_access_token === "REVOKED") {
        continue;
      }
      try {
        await plaidClient.itemRemove({
          access_token: decryptToken(it.plaid_access_token),
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[account/delete] itemRemove failed", e);
      }
    }
  }

  // ── Supabase: wipe every per-user row ───────────────────────────
  // Order: leaves of the FK graph first, then the trunks, then the
  // app_users row last. supabase-js doesn't expose BEGIN, so the
  // sequence is the only consistency guarantee.
  const tables = [
    // Engine outputs + per-user audit trails
    "subscription_charges",
    "cancellations",
    "monitoring_alerts",
    "feedback_events",
    "user_overrides",
    "user_preferences",
    "subscriptions",
    "scan_runs",
    "scan_snapshots",
    "plaid_transactions",
    "ai_calls",
    // Billing mirrors — cancel above only flips Stripe state; we still
    // need to wipe our local row so the user can re-sign-up cleanly.
    "billing_email_dispatches",
    "payment_methods_mirror",
    "billing_entitlements",
    "subscriptions_billing",
    "billing_events",
    "stripe_customers",
    // Plaid plumbing
    "plaid_items",
    // app_users is the parent — must come last
    "app_users",
  ] as const;

  for (const t of tables) {
    // app_users uses id as the PK (clerk user id); every other table
    // uses user_id.
    const col = t === "app_users" ? "id" : "user_id";
    const { error } = await supabaseAdmin.from(t).delete().eq(col, user.id);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`[account/delete] delete from ${t} failed`, error.message);
    }
  }

  return NextResponse.json({ ok: true });
}
