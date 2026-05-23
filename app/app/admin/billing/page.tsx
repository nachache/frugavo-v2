import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isBillingAdmin } from "@/lib/billing/admin-gate";
import { AdminBillingReplayButton } from "@/components/app/admin-billing-replay-button";

// /app/admin/billing — operator surface for the Stripe billing layer.
//
// Renders:
//   - State counts: active / trialing / grace / cancelled_active / past_due / expired
//   - 7-day churn count (active → cancelled_active or expired in last 7d)
//   - Per-customer event log: every user with their state + latest 3 events
//   - Per-customer replay button: re-runs projector from raw events
//
// Gated to FRUGAVO_ADMIN_USER_IDS env var.

export const dynamic = "force-dynamic";

type EntitlementRow = {
  clerk_user_id: string;
  entitlement_state: string;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  expires_at: string | null;
  updated_at: string;
};

type EventRow = {
  id: string;
  event_id: string;
  event_type: string;
  stripe_customer_id: string | null;
  received_at: string;
  projected_at: string | null;
};

export default async function AdminBillingPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!isBillingAdmin(user.id)) redirect("/app");
  if (!supabaseAdmin) redirect("/app");

  // 1. State counts.
  const { data: countsRaw } = await supabaseAdmin
    .from("billing_entitlements")
    .select("entitlement_state");
  const counts: Record<string, number> = {
    none: 0,
    trialing: 0,
    active: 0,
    grace_period: 0,
    cancelled_active: 0,
    past_due: 0,
    expired: 0,
  };
  for (const r of countsRaw ?? []) {
    counts[r.entitlement_state] = (counts[r.entitlement_state] ?? 0) + 1;
  }

  // 2. 7-day churn count.
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: churnCount } = await supabaseAdmin
    .from("billing_entitlements")
    .select("clerk_user_id", { count: "exact", head: true })
    .in("entitlement_state", ["cancelled_active", "expired"])
    .gte("updated_at", sevenDaysAgo);

  // 3. Per-customer table — recent entitlements.
  const { data: entitlements } = (await supabaseAdmin
    .from("billing_entitlements")
    .select(
      "clerk_user_id, entitlement_state, stripe_subscription_id, trial_ends_at, expires_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(50)) as { data: EntitlementRow[] | null };

  // 4. Recent events feed (for the "what just happened?" surface).
  const { data: recentEvents } = (await supabaseAdmin
    .from("billing_events")
    .select(
      "id, event_id, event_type, stripe_customer_id, received_at, projected_at"
    )
    .order("received_at", { ascending: false })
    .limit(20)) as { data: EventRow[] | null };

  return (
    <section className="container-page py-8 md:py-12 max-w-[1200px] space-y-6">
      <div>
        <span className="text-[13px] font-medium text-brand">Admin</span>
        <h1 className="mt-2 font-display text-[28px] md:text-[36px] font-bold tracking-[-0.03em] leading-[1.1] text-ink">
          Billing
        </h1>
        <p className="mt-2 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
          State counts, recent activity, and per-customer replay tools for
          the Stripe billing layer.
        </p>
      </div>

      {/* State counts */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6">
        <div className="text-[15px] font-medium text-ink">
          Entitlement state
        </div>
        <div className="mt-3 grid grid-cols-3 md:grid-cols-7 gap-3">
          {Object.entries(counts).map(([state, n]) => (
            <div
              key={state}
              className="rounded-xl border border-hairline px-3 py-2.5"
            >
              <div className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-muted">
                {state.replace(/_/g, " ")}
              </div>
              <div className="mt-1 font-display text-[22px] font-bold tabular-nums text-ink leading-none">
                {n}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-hairline flex items-center gap-3 flex-wrap">
          <div className="text-[12.5px] text-ink-muted">7-day churn</div>
          <div className="text-[15px] font-medium tabular-nums text-ink">
            {churnCount ?? 0}
          </div>
          <div className="text-[12px] text-ink-muted">
            cancelled or expired in the last 7 days
          </div>
        </div>
      </div>

      {/* Recent events feed */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6">
        <div className="text-[15px] font-medium text-ink">Recent events</div>
        <div className="mt-3 divide-y divide-hairline">
          {(recentEvents ?? []).map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 py-2 text-[12.5px]"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${e.projected_at ? "bg-brand" : "bg-danger"}`}
                aria-label={e.projected_at ? "projected" : "unprojected"}
              />
              <span className="font-mono text-ink truncate flex-1">
                {e.event_type}
              </span>
              <span className="font-mono text-ink-muted truncate hidden md:block max-w-[260px]">
                {e.stripe_customer_id}
              </span>
              <span className="text-ink-muted whitespace-nowrap">
                {new Date(e.received_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "numeric",
                })}
              </span>
            </div>
          ))}
          {(recentEvents ?? []).length === 0 && (
            <div className="py-6 text-center text-[13px] text-ink-muted">
              No events yet.
            </div>
          )}
        </div>
      </div>

      {/* Per-customer table */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6">
        <div className="text-[15px] font-medium text-ink">Customers</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="font-medium py-2 pr-3">Clerk user</th>
                <th className="font-medium py-2 pr-3">State</th>
                <th className="font-medium py-2 pr-3">Subscription</th>
                <th className="font-medium py-2 pr-3">Trial ends</th>
                <th className="font-medium py-2 pr-3">Expires</th>
                <th className="font-medium py-2 pr-3">Updated</th>
                <th className="font-medium py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {(entitlements ?? []).map((e) => (
                <tr key={e.clerk_user_id}>
                  <td className="py-2 pr-3 font-mono text-ink truncate max-w-[200px]">
                    {e.clerk_user_id}
                  </td>
                  <td className="py-2 pr-3 text-ink">
                    {e.entitlement_state}
                  </td>
                  <td className="py-2 pr-3 font-mono text-ink-muted truncate max-w-[200px]">
                    {e.stripe_subscription_id ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">
                    {fmt(e.trial_ends_at)}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">
                    {fmt(e.expires_at)}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">
                    {fmt(e.updated_at)}
                  </td>
                  <td className="py-2">
                    <AdminBillingReplayButton clerkUserId={e.clerk_user_id} />
                  </td>
                </tr>
              ))}
              {(entitlements ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-ink-muted"
                  >
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}
