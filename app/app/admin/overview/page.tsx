import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { isBillingAdmin } from "@/lib/billing/admin-gate";

// /app/admin/overview — operator overview of the entire user base.
//
// What it shows:
//   • KPI tiles (total users, today / this week / this month signups,
//     bank-connected, first-scan-complete, meaningful-session)
//   • Funnel — signed up → connected bank → first scan complete →
//     meaningful first session → completed welcome reveal
//   • Recent signups (last 30) with per-user status badges
//
// What it deliberately does NOT show: anything that could be confused
// with a paid analytics product. This is a tactical operator surface,
// not a vanity dashboard. Numbers are queried live against Supabase
// every render; no caching, no incremental view, no aggregation
// snapshots. At 2 beta users this is the right tradeoff; revisit when
// the user base crosses ~10k.
//
// Gated by FRUGAVO_ADMIN_USER_IDS — same allowlist as /app/admin/billing.

export const dynamic = "force-dynamic";

type SignupRow = {
  id: string;
  email: string | null;
  created_at: string;
  welcomed_at: string | null;
  first_ready_at: string | null;
  dashboard_first_session_at: string | null;
  first_ready_email_sent_at: string | null;
  checkin_email_sent_at: string | null;
};

type PlaidRow = { user_id: string; status: string; institution_name: string | null };
type ScanRow = { user_id: string; status: string; detected_count: number | null };
type EntitlementRow = { clerk_user_id: string; entitlement_state: string };

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function AdminOverviewPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!isBillingAdmin(user.id)) redirect("/app");
  if (!supabaseAdmin) redirect("/app");

  // ─── KPI counts ─────────────────────────────────────────────
  // All counts run in parallel via Promise.all to keep render fast.
  const [
    totalUsersRes,
    todayRes,
    weekRes,
    monthRes,
    bankConnectedRes,
    firstReadyRes,
    sessionRes,
    welcomedRes,
    allUsersRes,
    plaidItemsRes,
    scanRunsRes,
    entitlementsRes,
  ] = await Promise.all([
    supabaseAdmin.from("app_users").select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("app_users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfTodayIso()),
    supabaseAdmin
      .from("app_users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", daysAgoIso(7)),
    supabaseAdmin
      .from("app_users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", daysAgoIso(30)),
    supabaseAdmin
      .from("app_users")
      .select("id", { count: "exact", head: true })
      .not("id", "is", null),
    supabaseAdmin
      .from("app_users")
      .select("*", { count: "exact", head: true })
      .not("first_ready_at", "is", null),
    supabaseAdmin
      .from("app_users")
      .select("*", { count: "exact", head: true })
      .not("dashboard_first_session_at", "is", null),
    supabaseAdmin
      .from("app_users")
      .select("*", { count: "exact", head: true })
      .not("welcomed_at", "is", null),
    supabaseAdmin
      .from("app_users")
      .select(
        "id, email, created_at, welcomed_at, first_ready_at, dashboard_first_session_at, first_ready_email_sent_at, checkin_email_sent_at"
      )
      .order("created_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("plaid_items")
      .select("user_id, status, institution_name"),
    supabaseAdmin
      .from("scan_runs")
      .select("user_id, status, detected_count")
      .in("status", ["done", "error", "timeout"])
      .order("finished_at", { ascending: false }),
    supabaseAdmin
      .from("billing_entitlements")
      .select("clerk_user_id, entitlement_state"),
  ]);

  const totalUsers = totalUsersRes.count ?? 0;
  const todayCount = todayRes.count ?? 0;
  const weekCount = weekRes.count ?? 0;
  const monthCount = monthRes.count ?? 0;
  const firstReadyCount = firstReadyRes.count ?? 0;
  const sessionCount = sessionRes.count ?? 0;
  const welcomedCount = welcomedRes.count ?? 0;

  // bank_connected = users with at least one plaid_items row in
  // active status. We compute this client-side from the plaid list
  // because Supabase head-counts don't support joins.
  const plaidItems = (plaidItemsRes.data ?? []) as PlaidRow[];
  const usersWithActiveBank = new Set(
    plaidItems.filter((p) => p.status === "active").map((p) => p.user_id)
  );
  const bankConnectedCount = usersWithActiveBank.size;
  void bankConnectedRes;

  // Build per-user dashboards
  const recentSignups = (allUsersRes.data ?? []) as SignupRow[];
  const scanByUser = new Map<string, ScanRow>();
  for (const s of (scanRunsRes.data ?? []) as ScanRow[]) {
    if (!scanByUser.has(s.user_id)) scanByUser.set(s.user_id, s);
  }
  const plaidByUser = new Map<string, PlaidRow[]>();
  for (const p of plaidItems) {
    const list = plaidByUser.get(p.user_id) ?? [];
    list.push(p);
    plaidByUser.set(p.user_id, list);
  }
  const entitlementByUser = new Map<string, string>();
  for (const e of (entitlementsRes.data ?? []) as EntitlementRow[]) {
    entitlementByUser.set(e.clerk_user_id, e.entitlement_state);
  }

  return (
    <section className="container-page py-8 md:py-12 max-w-[1200px]">
      <div className="mb-6">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition"
        >
          ← Back to dashboard
        </Link>
        <div className="mt-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <span className="text-[13px] font-medium text-brand">
              Admin · Overview
            </span>
            <h1 className="mt-1 font-display text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
              User base at a glance
            </h1>
          </div>
          <div className="text-[12px] text-ink-muted tabular-nums">
            Live · queried at {new Date().toLocaleTimeString("en-US")}
          </div>
        </div>
      </div>

      {/* ─── KPI tiles ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiTile label="Total users" value={totalUsers} accent />
        <KpiTile label="Today" value={todayCount} />
        <KpiTile label="Last 7 days" value={weekCount} />
        <KpiTile label="Last 30 days" value={monthCount} />
      </div>

      {/* ─── Funnel ───────────────────────────────────────── */}
      <div className="mt-8 rounded-2xl border border-hairline bg-surface p-5 md:p-7">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              Conversion funnel
            </span>
            <h2 className="mt-1 text-[18px] md:text-[20px] font-display font-semibold text-ink">
              Where users actually land
            </h2>
          </div>
          <span className="text-[11.5px] text-ink-muted">
            All-time cohort
          </span>
        </div>
        <div className="mt-5 space-y-2.5">
          <FunnelBar
            label="Signed up"
            count={totalUsers}
            denominator={totalUsers}
          />
          <FunnelBar
            label="Connected a bank"
            count={bankConnectedCount}
            denominator={totalUsers}
          />
          <FunnelBar
            label="First scan complete"
            count={firstReadyCount}
            denominator={totalUsers}
          />
          <FunnelBar
            label="Completed welcome reveal"
            count={welcomedCount}
            denominator={totalUsers}
          />
          <FunnelBar
            label="Meaningful first session"
            count={sessionCount}
            denominator={totalUsers}
          />
        </div>
      </div>

      {/* ─── Recent signups ───────────────────────────────── */}
      <div className="mt-8 rounded-2xl border border-hairline bg-surface overflow-hidden">
        <div className="px-5 md:px-7 py-4 md:py-5 border-b border-hairline/60 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              Recent signups
            </span>
            <h2 className="mt-1 text-[18px] md:text-[20px] font-display font-semibold text-ink">
              Last {recentSignups.length}
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted bg-canvas/40">
                <th className="px-4 md:px-5 py-3">Email</th>
                <th className="px-3 py-3">Joined</th>
                <th className="px-3 py-3">Plan</th>
                <th className="px-3 py-3">Bank</th>
                <th className="px-3 py-3">Scan</th>
                <th className="px-3 py-3">Welcomed</th>
                <th className="px-3 py-3">Session</th>
                <th className="px-3 py-3">Emails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline/60">
              {recentSignups.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-ink-muted text-[13px]"
                  >
                    No signups yet.
                  </td>
                </tr>
              ) : (
                recentSignups.map((u) => {
                  const banks = plaidByUser.get(u.id) ?? [];
                  const activeBank = banks.find((b) => b.status === "active");
                  const scan = scanByUser.get(u.id);
                  const ent =
                    entitlementByUser.get(u.id) ?? "none";
                  return (
                    <tr key={u.id} className="hover:bg-ink/[0.02] transition">
                      <td className="px-4 md:px-5 py-3 align-top">
                        <div className="text-ink font-medium truncate max-w-[220px]">
                          {u.email ?? "(no email)"}
                        </div>
                        <div className="text-[11px] text-ink-muted font-mono truncate max-w-[220px]">
                          {u.id}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-ink-body tabular-nums">
                        {relativeTime(u.created_at)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <EntitlementChip state={ent} />
                      </td>
                      <td className="px-3 py-3 align-top">
                        {activeBank ? (
                          <span className="inline-flex items-center gap-1 text-brand">
                            <Dot color="brand" />
                            <span className="text-[12px] text-ink truncate">
                              {activeBank.institution_name ?? "Connected"}
                            </span>
                          </span>
                        ) : banks.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-accent">
                            <Dot color="accent" />
                            <span className="text-[12px] text-ink-muted">
                              {banks[0].status}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {scan ? (
                          <span className="inline-flex items-center gap-1">
                            <Dot
                              color={
                                scan.status === "done"
                                  ? "brand"
                                  : scan.status === "error"
                                    ? "danger"
                                    : "muted"
                              }
                            />
                            <span className="text-[12px] text-ink-body">
                              {scan.status === "done"
                                ? `${scan.detected_count ?? 0} subs`
                                : scan.status}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-[12px] text-ink-body tabular-nums">
                        {u.welcomed_at ? relativeTime(u.welcomed_at) : "—"}
                      </td>
                      <td className="px-3 py-3 align-top text-[12px] text-ink-body tabular-nums">
                        {u.dashboard_first_session_at
                          ? relativeTime(u.dashboard_first_session_at)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col gap-1 text-[11px] text-ink-muted">
                          {u.first_ready_email_sent_at && (
                            <span className="inline-flex items-center gap-1">
                              <Dot color="brand" />
                              ready sent
                            </span>
                          )}
                          {u.checkin_email_sent_at && (
                            <span className="inline-flex items-center gap-1">
                              <Dot color="accent" />
                              checkin sent
                            </span>
                          )}
                          {!u.first_ready_email_sent_at &&
                            !u.checkin_email_sent_at && (
                              <span className="text-ink-muted/60">—</span>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-6 text-[11.5px] text-ink-muted">
        Data is live-queried from Supabase on every render. No caching. If a
        signup happened in the last few seconds it's already here.
      </p>
    </section>
  );
}

// ─── small components ─────────────────────────────────────────────

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border bg-surface p-4 md:p-5",
        accent
          ? "border-brand/30 ring-1 ring-brand/15"
          : "border-hairline",
      ].join(" ")}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </div>
      <div
        className={[
          "mt-1 font-display font-bold tabular-nums leading-none text-[34px] md:text-[40px] tracking-[-0.03em]",
          accent ? "text-brand" : "text-ink",
        ].join(" ")}
      >
        {value.toLocaleString("en-US")}
      </div>
    </div>
  );
}

function FunnelBar({
  label,
  count,
  denominator,
}: {
  label: string;
  count: number;
  denominator: number;
}) {
  const pct =
    denominator === 0 ? 0 : Math.round((count / denominator) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-ink-body">{label}</span>
        <span className="tabular-nums text-ink">
          <span className="font-medium">{count.toLocaleString("en-US")}</span>
          <span className="text-ink-muted ml-2 text-[12px]">{pct}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-ink/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EntitlementChip({ state }: { state: string }) {
  const { label, color } = (() => {
    switch (state) {
      case "beta_access":
        return { label: "Founder", color: "brand" as const };
      case "trialing":
      case "active":
      case "cancelled_active":
        return { label: state.replace("_", " "), color: "brand" as const };
      case "grace_period":
      case "past_due":
        return { label: state.replace("_", " "), color: "accent" as const };
      case "expired":
        return { label: "expired", color: "muted" as const };
      default:
        return { label: state, color: "muted" as const };
    }
  })();
  const cls =
    color === "brand"
      ? "bg-brand/10 border-brand/25 text-brand"
      : color === "accent"
        ? "bg-accent/10 border-accent/25 text-accent"
        : "bg-ink/[0.05] border-hairline text-ink-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 h-5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${cls}`}
    >
      {label}
    </span>
  );
}

function Dot({
  color,
}: {
  color: "brand" | "accent" | "danger" | "muted";
}) {
  const cls =
    color === "brand"
      ? "bg-brand"
      : color === "accent"
        ? "bg-accent"
        : color === "danger"
          ? "bg-danger"
          : "bg-ink/30";
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`}
    />
  );
}
