// Orchestrator — runs every detector after a scan completes and
// upserts the resulting alerts into monitoring_alerts.
//
// Called from lib/scan.ts after the scan_snapshot has been written.
// Idempotent via (user_id, dedup_key) unique index — running this
// twice on identical inputs produces identical row counts.
//
// Never throws: a detector failure must not break the scan pipeline.
// We log errors and continue.

import { supabaseAdmin } from "@/lib/supabase";
import type { SnapshotRow } from "@/lib/types/snapshot";
import { SCANNER_VERSION } from "@/lib/scanner-version";
import {
  detectNewSubscriptions,
  detectPriceIncreases,
  detectUpcomingRenewals,
  detectDormantResumed,
  detectHighCharges,
  detectTrialConversions,
  detectMissingRenewals,
  detectDuplicateSubscriptions,
} from "./detectors";
import type { CandidateAlert } from "./types";
import { dispatchUrgentForUser } from "@/lib/notifications/dispatch";

type SnapshotRecord = { rows: SnapshotRow[] };

export async function runMonitoringForUser(args: {
  userId: string;
  scanRunId: string;
}): Promise<{ alerts_written: number }> {
  if (!supabaseAdmin) return { alerts_written: 0 };
  const { userId, scanRunId } = args;
  const asOf = new Date();

  // 1. Pull the TWO most recent snapshots for this user. The most
  // recent is "current"; the one before is "prior". The scan that
  // just completed already wrote its snapshot, so current is the
  // freshest row.
  const { data: snaps } = await supabaseAdmin
    .from("scan_snapshots")
    .select("payload, scan_run_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(2);
  const snapshotRows = (snaps ?? []) as Array<{
    payload: SnapshotRecord;
    scan_run_id: string;
    created_at: string;
  }>;
  if (snapshotRows.length === 0) return { alerts_written: 0 };

  const current = snapshotRows[0].payload?.rows ?? [];
  const prior = snapshotRows[1]?.payload?.rows ?? null;

  // 2. Build charge history maps for dormancy + high-charge detectors.
  // Pull only what we need — accepted charges grouped by stream id,
  // outlier charges from the last 7 days for high-charge detection.
  const chargeHistoryByMerchant = new Map<
    string,
    { posted_date: string; amount_cents: number }[]
  >();
  const medianByMerchant = new Map<string, number>();
  {
    const { data } = await supabaseAdmin
      .from("subscription_charges")
      .select("subscription_id, posted_date, amount_cents")
      .eq("user_id", userId)
      .eq("detector_status", "accepted")
      .order("posted_date", { ascending: true });
    const rows = (data ?? []) as Array<{
      subscription_id: string;
      posted_date: string;
      amount_cents: number;
    }>;
    // Group by subscription_id. The snapshot uses plaid_stream_id =
    // subscription_key (set by the engine at scan time and mirrored
    // onto subscriptions.id at upsert time). We map subscription_id
    // → plaid_stream_id via a per-user lookup below.
    const groupedById = new Map<
      string,
      { posted_date: string; amount_cents: number }[]
    >();
    for (const r of rows) {
      const arr = groupedById.get(r.subscription_id) ?? [];
      arr.push({ posted_date: r.posted_date, amount_cents: r.amount_cents });
      groupedById.set(r.subscription_id, arr);
    }
    // Need subscription id → subscription_key mapping.
    const { data: subRows } = await supabaseAdmin
      .from("subscriptions")
      .select("id, subscription_key")
      .eq("user_id", userId)
      .not("subscription_key", "is", null);
    const keyById = new Map(
      ((subRows ?? []) as Array<{ id: string; subscription_key: string }>).map(
        (r) => [r.id, r.subscription_key]
      )
    );
    for (const [subId, history] of groupedById) {
      const k = keyById.get(subId);
      if (!k) continue;
      chargeHistoryByMerchant.set(k, history);
      // Median.
      const sorted = history.map((h) => h.amount_cents).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0
          ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
          : sorted[mid];
      medianByMerchant.set(k, median);
    }
  }

  // 3. Pull outlier charges from the last 7 days for the high-charge
  // detector. We join through subscriptions for merchant_name + key.
  const sevenAgo = new Date(asOf);
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const sevenAgoIso = sevenAgo.toISOString().slice(0, 10);
  const outlierCharges: Parameters<typeof detectHighCharges>[0]["outlierCharges"] = [];
  {
    const { data } = await supabaseAdmin
      .from("subscription_charges")
      .select(
        "plaid_transaction_id, subscription_id, merchant_key, posted_date, amount_cents"
      )
      .eq("user_id", userId)
      .eq("detector_status", "outlier")
      .gte("posted_date", sevenAgoIso);
    const rows = (data ?? []) as Array<{
      plaid_transaction_id: string;
      subscription_id: string;
      merchant_key: string | null;
      posted_date: string;
      amount_cents: number;
    }>;
    if (rows.length > 0) {
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("id, merchant_name, subscription_key")
        .in("id", Array.from(new Set(rows.map((r) => r.subscription_id))));
      const subById = new Map(
        ((subs ?? []) as Array<{
          id: string;
          merchant_name: string;
          subscription_key: string | null;
        }>).map((r) => [r.id, r])
      );
      for (const r of rows) {
        const s = subById.get(r.subscription_id);
        if (!s) continue;
        outlierCharges.push({
          plaid_transaction_id: r.plaid_transaction_id,
          subscription_id: r.subscription_id,
          merchant_key: s.subscription_key ?? r.merchant_key,
          merchant_name: s.merchant_name,
          posted_date: r.posted_date,
          amount_cents: r.amount_cents,
        });
      }
    }
  }

  // 4. Run every detector. Each returns CandidateAlert[].
  const candidates: CandidateAlert[] = [];
  try {
    candidates.push(...detectNewSubscriptions({ current, prior }));
  } catch (e) {
    console.warn("[monitoring] detectNewSubscriptions failed", e);
  }
  try {
    candidates.push(...detectPriceIncreases({ current, prior }));
  } catch (e) {
    console.warn("[monitoring] detectPriceIncreases failed", e);
  }
  try {
    candidates.push(...detectUpcomingRenewals({ current, asOf }));
  } catch (e) {
    console.warn("[monitoring] detectUpcomingRenewals failed", e);
  }
  try {
    candidates.push(
      ...detectDormantResumed({ current, chargeHistoryByMerchant, asOf })
    );
  } catch (e) {
    console.warn("[monitoring] detectDormantResumed failed", e);
  }
  try {
    candidates.push(
      ...detectHighCharges({ outlierCharges, medianByMerchant })
    );
  } catch (e) {
    console.warn("[monitoring] detectHighCharges failed", e);
  }
  try {
    candidates.push(
      ...detectTrialConversions({ chargeHistoryByMerchant, asOf })
    );
  } catch (e) {
    console.warn("[monitoring] detectTrialConversions failed", e);
  }
  try {
    candidates.push(...detectMissingRenewals({ current, asOf }));
  } catch (e) {
    console.warn("[monitoring] detectMissingRenewals failed", e);
  }
  try {
    candidates.push(...detectDuplicateSubscriptions({ current }));
  } catch (e) {
    console.warn("[monitoring] detectDuplicateSubscriptions failed", e);
  }

  if (candidates.length === 0) return { alerts_written: 0 };

  // 5. Resolve subscription_id for each candidate via plaid_stream_id.
  // Snapshot rows carry plaid_stream_id which is subscription_key;
  // we map to subscriptions.id once at the top. We also pull
  // recurring_type so we can SKIP non-subscription alerts at write
  // time — protection alerts are for subscriptions only, not bills
  // or commerce. (Filtering at read time too as a belt-and-suspenders.)
  const { data: subsForMap } = await supabaseAdmin
    .from("subscriptions")
    .select("id, subscription_key, merchant_key, recurring_type")
    .eq("user_id", userId);
  const subIdByKey = new Map(
    ((subsForMap ?? []) as Array<{
      id: string;
      subscription_key: string | null;
      merchant_key: string | null;
      recurring_type: string | null;
    }>).map((r) => [r.subscription_key ?? "", r])
  );
  const tierBySubId = new Map(
    ((subsForMap ?? []) as Array<{
      id: string;
      recurring_type: string | null;
    }>).map((r) => [r.id, r.recurring_type ?? "uncertain_recurring"])
  );

  const rowsToUpsert = candidates
    .map((c) => {
      const streamId = (c.details as { plaid_stream_id?: string }).plaid_stream_id;
      const sub = streamId ? subIdByKey.get(streamId) : null;
      const subId = c.subscription_id ?? sub?.id ?? null;
      return {
        user_id: userId,
        subscription_id: subId,
        merchant_key: c.merchant_key ?? sub?.merchant_key ?? null,
        merchant_name: c.merchant_name ?? null,
        alert_type: c.alert_type,
        severity: c.severity,
        details: c.details,
        dedup_key: c.dedup_key,
        status: "active",
        scan_run_id: scanRunId,
        scanner_version: SCANNER_VERSION,
        _tier: subId ? tierBySubId.get(subId) ?? null : null,
      };
    })
    .filter((row) => {
      // Drop alerts whose subscription is a bill, commerce, or
      // uncertain row. If we couldn't resolve the subscription
      // (no _tier), let it through — better to surface an
      // unattributed alert than silently lose it.
      if (!row._tier) return true;
      return row._tier === "confirmed_subscription";
    })
    .map(({ _tier, ...rest }) => {
      void _tier;
      return rest;
    });

  // 6. Upsert. (user_id, dedup_key) is unique — ignoreDuplicates lets
  // the same detector run a second time without exception.
  const CHUNK = 200;
  let written = 0;
  for (let i = 0; i < rowsToUpsert.length; i += CHUNK) {
    const chunk = rowsToUpsert.slice(i, i + CHUNK);
    const { error, count } = await supabaseAdmin
      .from("monitoring_alerts")
      .upsert(chunk, {
        onConflict: "user_id,dedup_key",
        ignoreDuplicates: true,
        count: "exact",
      });
    if (error) {
      console.error("[monitoring] upsert failed", error);
      continue;
    }
    written += count ?? 0;
  }

  // 7. Notify — fire urgent emails for any alert that's brand new from
  // THIS scan. The upsert above writes scan_run_id = current scanRunId
  // only on newly-inserted rows (existing rows are skipped intact via
  // ignoreDuplicates), so the query is straightforward. The email
  // dispatch table dedups by (alert_id, channel) so a re-run of the
  // same scan won't double-send.
  if (written > 0) {
    const { data: newAlerts } = await supabaseAdmin
      .from("monitoring_alerts")
      .select("id")
      .eq("user_id", userId)
      .eq("scan_run_id", scanRunId);
    const ids = ((newAlerts ?? []) as Array<{ id: string }>).map(
      (r) => r.id
    );
    if (ids.length > 0) {
      try {
        await dispatchUrgentForUser({ userId, alertIds: ids });
      } catch (e) {
        console.warn("[monitoring] urgent dispatch failed", e);
      }
    }
  }

  return { alerts_written: written };
}
