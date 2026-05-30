import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AlertsInbox } from "@/components/app/alerts-inbox";
import { BackPill } from "@/components/app/back-pill";
import { tierFor } from "@/lib/monitoring/tiers";

// /app/alerts — full Peace of Mind inbox.
//
// Renders three sections: active, acknowledged, dismissed. Each row
// supports the same actions as the dashboard card. Reads alerts
// server-side so the initial paint shows real data.

export const dynamic = "force-dynamic";

type AlertRow = {
  id: string;
  subscription_id: string | null;
  merchant_key: string | null;
  merchant_name: string | null;
  alert_type: string;
  severity: "info" | "notice" | "urgent";
  status: "active" | "acknowledged" | "dismissed" | "resolved";
  details: Record<string, unknown>;
  created_at: string;
  acknowledged_at: string | null;
  dismissed_at: string | null;
};

export default async function AlertsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!supabaseAdmin) redirect("/app");

  const { data } = await supabaseAdmin
    .from("monitoring_alerts")
    .select(
      "id, subscription_id, merchant_key, merchant_name, alert_type, severity, status, details, created_at, acknowledged_at, dismissed_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  // Filter to subscription-tier alerts only. Bills / commerce don't
  // belong here — a missed renewal on a mortgage or a price hike on a
  // utility isn't an "alert" in the protection sense. We look up the
  // tier per subscription_id and drop alerts that point at non-sub rows.
  const { data: subTierRows } = await supabaseAdmin
    .from("subscriptions")
    .select("id, recurring_type")
    .eq("user_id", user.id);
  const nonSubIds = new Set(
    (subTierRows ?? [])
      .filter(
        (r) =>
          (r.recurring_type as string | null) !== "confirmed_subscription"
      )
      .map((r) => r.id as string)
  );
  // Tier gate (lib/monitoring/tiers.ts) — silent detectors never
  // appear in the alerts feed even though their rows exist in
  // monitoring_alerts. Primary + secondary both flow through; the
  // AlertsInbox UI splits them visually.
  const alerts = ((data ?? []) as AlertRow[]).filter(
    (a) =>
      (!a.subscription_id || !nonSubIds.has(a.subscription_id)) &&
      tierFor(a.alert_type) !== "silent"
  );

  return (
    <section className="container-page py-8 md:py-12 max-w-[1000px]">
      <div className="mb-6 md:mb-8">
        <BackPill href="/app" label="Back to dashboard" />
      </div>

      <span className="text-[13px] font-medium text-brand">Protection</span>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Your alerts
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-body">
        Everything we&apos;ve caught on your accounts. New subscriptions,
        price increases, unusual charges, upcoming renewals.
      </p>

      <div className="mt-8">
        <AlertsInbox initial={alerts} />
      </div>
    </section>
  );
}
