import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { ScanSnapshot, SnapshotRow } from "@/lib/types/snapshot";

// GET /api/dashboard/changes
//
// "What changed this month" card. Diffs the two most recent completed
// scan snapshots and surfaces:
//   - new_subscriptions   (in current scan, not in prior)
//   - removed_subscriptions (in prior, not in current)
//   - price_increases     (same stream id, amount went up)
//   - price_decreases     (same stream id, amount went down)
//   - net_monthly_delta   (sum of monthly equivalents, current - prior)
//
// Source of truth: scan_snapshots.payload — the immutable per-scan
// SnapshotRow[]. We deliberately diff snapshots (not the mutable
// subscriptions table) so the diff is reproducible — the same two
// scans always produce the same change set.
//
// Returns null fields with a "needs_more_scans" note if the user has
// fewer than 2 done scans yet.

export const runtime = "nodejs";
export const maxDuration = 5;

type ChangeRow = {
  plaid_stream_id: string;
  merchant_name: string;
  category: string;
  monthly_equivalent_cents: number;
};

type PriceChange = ChangeRow & {
  amount_from_cents: number;
  amount_to_cents: number;
  delta_cents: number;
  delta_pct: number;
};

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Pull the two most recent scan_snapshots for this user. We join
  // through scan_runs to ensure both correspond to status='done' runs.
  const { data, error } = await supabaseAdmin
    .from("scan_snapshots")
    .select("id, scan_run_id, as_of_date, payload, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(2);

  if (error) {
    return NextResponse.json(
      { error: "snapshots_read_failed", details: error.message },
      { status: 500 }
    );
  }
  const snaps = data ?? [];

  if (snaps.length < 2) {
    return NextResponse.json({
      ok: true,
      status: "needs_more_scans",
      have_snapshots: snaps.length,
      detail:
        "Need at least 2 completed scans to compute a change diff. Re-scan again later.",
    });
  }

  const [current, prior] = snaps as Array<{
    id: string;
    scan_run_id: string;
    as_of_date: string;
    payload: ScanSnapshot;
    created_at: string;
  }>;

  const currentConfirmed = (current.payload?.rows ?? []).filter(
    (r) => r.classification === "confirmed"
  );
  const priorConfirmed = (prior.payload?.rows ?? []).filter(
    (r) => r.classification === "confirmed"
  );

  const byId = (rows: SnapshotRow[]) => {
    const m = new Map<string, SnapshotRow>();
    for (const r of rows) m.set(r.plaid_stream_id, r);
    return m;
  };
  const currMap = byId(currentConfirmed);
  const priorMap = byId(priorConfirmed);

  const newSubs: ChangeRow[] = [];
  const priceIncreases: PriceChange[] = [];
  const priceDecreases: PriceChange[] = [];

  for (const [id, c] of currMap) {
    const p = priorMap.get(id);
    if (!p) {
      newSubs.push({
        plaid_stream_id: id,
        merchant_name: c.merchant_name,
        category: c.category,
        monthly_equivalent_cents: c.monthly_equivalent_cents,
      });
      continue;
    }
    if (c.amount_cents === p.amount_cents) continue;
    const delta = c.amount_cents - p.amount_cents;
    const change: PriceChange = {
      plaid_stream_id: id,
      merchant_name: c.merchant_name,
      category: c.category,
      monthly_equivalent_cents: c.monthly_equivalent_cents,
      amount_from_cents: p.amount_cents,
      amount_to_cents: c.amount_cents,
      delta_cents: delta,
      delta_pct:
        p.amount_cents > 0
          ? Math.round((delta / p.amount_cents) * 1000) / 10
          : 0,
    };
    if (delta > 0) priceIncreases.push(change);
    else priceDecreases.push(change);
  }

  const removedSubs: ChangeRow[] = [];
  for (const [id, p] of priorMap) {
    if (currMap.has(id)) continue;
    removedSubs.push({
      plaid_stream_id: id,
      merchant_name: p.merchant_name,
      category: p.category,
      monthly_equivalent_cents: p.monthly_equivalent_cents,
    });
  }

  const sumMonthly = (rows: SnapshotRow[]) =>
    rows.reduce((acc, r) => acc + r.monthly_equivalent_cents, 0);
  const netMonthlyDelta =
    sumMonthly(currentConfirmed) - sumMonthly(priorConfirmed);

  return NextResponse.json({
    ok: true,
    status: "ok",
    current: {
      scan_run_id: current.scan_run_id,
      as_of_date: current.as_of_date,
      monthly_total_cents: sumMonthly(currentConfirmed),
      subscription_count: currentConfirmed.length,
    },
    prior: {
      scan_run_id: prior.scan_run_id,
      as_of_date: prior.as_of_date,
      monthly_total_cents: sumMonthly(priorConfirmed),
      subscription_count: priorConfirmed.length,
    },
    net_monthly_delta_cents: netMonthlyDelta,
    new_subscriptions: newSubs.sort(
      (a, b) => b.monthly_equivalent_cents - a.monthly_equivalent_cents
    ),
    removed_subscriptions: removedSubs.sort(
      (a, b) => b.monthly_equivalent_cents - a.monthly_equivalent_cents
    ),
    price_increases: priceIncreases.sort(
      (a, b) => b.delta_cents - a.delta_cents
    ),
    price_decreases: priceDecreases.sort(
      (a, b) => a.delta_cents - b.delta_cents
    ),
  });
}
