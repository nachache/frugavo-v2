import { plaidClient, PLAID_ENV } from "./plaid";
import { supabaseAdmin } from "./supabase";
import { normalizeMerchant } from "@/lib/ai/normalize";
import {
  publishScanEvent,
  cacheDel,
  cacheKey,
  tryAcquireLock,
} from "@/lib/cache";
import type {
  Frequency,
  ScanEvent,
  ScanRow,
  ScanPhase,
} from "@/lib/types/scan";

// ---------------------------------------------------------------------------
// Scan orchestrator.
//
// Pipeline per Plaid Item:
//   1. /transactions/recurring/get → outflow_streams
//   2. For each stream (concurrency-capped fanout):
//      a. AI normalize merchant (cache + 800ms timeout + fallback)
//      b. Compute regret_score
//      c. Upsert into subscriptions
//      d. Publish a `row` SSE event
//   3. Publish a final `total` then `complete` event.
//
// Multi-item fanout uses Promise.allSettled with a manual concurrency cap
// of 6 so one slow/dead Item never blocks fresh ones (spec section 3).
// ---------------------------------------------------------------------------

const ITEM_CONCURRENCY = 6;
const ROW_CONCURRENCY = 8;

export type ScanResult = {
  scan_id: string;
  detected: number;
  failedItems: number;
  duration_ms: number;
  error?: string;
};

const SANDBOX_FALLBACK_SUBS = [
  { merchant: "Netflix", amount_cents: 2299, frequency: "monthly" as const },
  { merchant: "Spotify", amount_cents: 1199, frequency: "monthly" as const },
  { merchant: "Adobe Creative Cloud", amount_cents: 5999, frequency: "monthly" as const },
  { merchant: "The New York Times", amount_cents: 2500, frequency: "monthly" as const },
  { merchant: "Peloton", amount_cents: 4400, frequency: "monthly" as const },
  { merchant: "LinkedIn Premium", amount_cents: 3999, frequency: "monthly" as const },
  { merchant: "iCloud+", amount_cents: 999, frequency: "monthly" as const },
  { merchant: "Audible", amount_cents: 1495, frequency: "monthly" as const },
  { merchant: "Dropbox", amount_cents: 1199, frequency: "monthly" as const },
  { merchant: "HelloFresh", amount_cents: 8994, frequency: "monthly" as const },
];

export type ScanSource = "plaid" | "webhook" | "manual" | "first_connect";

// Entry point. Returns the scan_id immediately after creating the
// scan_runs row, then drives the rest synchronously inside this call.
// Callers that need true async kickoff should `void runScanForUser(...)`.
// The SSE endpoint reads from Redis Stream `scan:{scan_id}:events`.
export async function runScanForUser(
  userId: string,
  source: ScanSource = "first_connect"
): Promise<ScanResult> {
  const t0 = Date.now();
  if (!plaidClient || !supabaseAdmin) {
    return {
      scan_id: "",
      detected: 0,
      failedItems: 0,
      duration_ms: 0,
      error: "Server not configured",
    };
  }

  // Re-scan lock — prevents two concurrent scans for the same user from
  // double-publishing. 60s TTL is the upper bound on a single scan.
  const lockKey = cacheKey.rescanLock(userId);
  const gotLock = await tryAcquireLock(lockKey, 60);
  if (!gotLock) {
    return {
      scan_id: "",
      detected: 0,
      failedItems: 0,
      duration_ms: 0,
      error: "scan_in_progress",
    };
  }

  const { data: runRow, error: runErr } = await supabaseAdmin
    .from("scan_runs")
    .insert({ user_id: userId, source, status: "running" })
    .select("id")
    .single();

  if (runErr || !runRow) {
    return {
      scan_id: "",
      detected: 0,
      failedItems: 0,
      duration_ms: 0,
      error: "failed_to_create_scan_run",
    };
  }
  const scanId = runRow.id as string;

  await emit(scanId, { type: "progress", scan_id: scanId, phase: "connecting" });

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("plaid_items")
    .select("id, plaid_access_token, plaid_item_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (itemsErr || !items || items.length === 0) {
    await finalizeScan(scanId, userId, 0, 0, t0, "done");
    return {
      scan_id: scanId,
      detected: 0,
      failedItems: 0,
      duration_ms: Date.now() - t0,
    };
  }

  await emit(scanId, { type: "progress", scan_id: scanId, phase: "reading" });

  let detected = 0;
  let failedItems = 0;
  let monthlyTotalCents = 0;

  await runWithCap(items, ITEM_CONCURRENCY, async (item) => {
    try {
      await scanOneItem({
        userId,
        scanId,
        plaidItemRowId: item.id,
        accessToken: item.plaid_access_token,
        onRow: (cents) => {
          monthlyTotalCents += cents;
          detected += 1;
        },
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[scan] item failed", item.id, e);
      failedItems += 1;
    }
  });

  if (detected === 0 && PLAID_ENV === "sandbox" && items.length > 0) {
    detected = await seedSandboxFallback(
      userId,
      items[0].id,
      scanId,
      (cents) => {
        monthlyTotalCents += cents;
      }
    );
  }

  await emit(scanId, { type: "progress", scan_id: scanId, phase: "spotting" });
  await emit(scanId, {
    type: "total",
    scan_id: scanId,
    monthly_cents: monthlyTotalCents,
    count: detected,
  });

  await finalizeScan(
    scanId,
    userId,
    detected,
    failedItems,
    t0,
    failedItems > 0 && detected === 0 ? "error" : "done"
  );

  await cacheDel(cacheKey.userScan(userId));

  return {
    scan_id: scanId,
    detected,
    failedItems,
    duration_ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------

type PlaidStreamLike = {
  stream_id: string;
  merchant_name?: string | null;
  description?: string | null;
  average_amount?: {
    amount?: number;
    iso_currency_code?: string | null;
    unofficial_currency_code?: string | null;
  };
  last_amount?: { amount?: number };
  frequency?: string;
  last_date?: string;
  is_active?: boolean;
};

async function scanOneItem(args: {
  userId: string;
  scanId: string;
  plaidItemRowId: string;
  accessToken: string;
  onRow: (monthlyEquivalentCents: number) => void;
}): Promise<void> {
  const { userId, scanId, plaidItemRowId, accessToken, onRow } = args;

  const recurring = await plaidClient!.transactionsRecurringGet({
    access_token: accessToken,
  });

  const streams = (recurring.data.outflow_streams ?? []) as PlaidStreamLike[];

  await runWithCap(streams, ROW_CONCURRENCY, async (stream) => {
    const amount = stream.average_amount?.amount ?? 0;
    if (!amount || amount <= 0) return;

    const amountCents = Math.round(amount * 100);
    const rawDescriptor =
      stream.description ?? stream.merchant_name ?? "Unknown merchant";
    const frequency = normalizeFrequency(stream.frequency);

    const norm = await normalizeMerchant(
      {
        raw_descriptor: rawDescriptor,
        plaid_merchant_name: stream.merchant_name ?? null,
        amount_cents: amountCents,
        frequency,
      },
      { userId, scanRunId: scanId }
    );

    const predictedNext =
      (stream as { predicted_next_date?: string | null }).predicted_next_date ??
      null;

    const currency =
      stream.average_amount?.iso_currency_code ??
      stream.average_amount?.unofficial_currency_code ??
      "USD";

    const isActive = stream.is_active !== false;
    const regret = regretScore({
      amount_cents: amountCents,
      frequency,
      last_charged_at: stream.last_date ?? null,
    });

    const row: ScanRow = {
      stream_id: stream.stream_id,
      merchant_name: norm.merchant_name,
      raw_descriptor: rawDescriptor,
      amount_cents: amountCents,
      currency,
      frequency,
      last_charged_at: stream.last_date ?? null,
      next_expected_charge_at: predictedNext,
      regret_score: regret,
      category: norm.category,
      ai_source: norm.ai_source,
    };

    const { error: upsertErr } = await supabaseAdmin!
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plaid_item_id: plaidItemRowId,
          plaid_stream_id: stream.stream_id,
          merchant_name: row.merchant_name,
          normalized_name: row.merchant_name,
          category: row.category,
          amount_cents: row.amount_cents,
          currency: row.currency,
          frequency: row.frequency,
          last_charged_at: row.last_charged_at,
          next_expected_charge_at: row.next_expected_charge_at,
          regret_score: row.regret_score,
          ai_source: row.ai_source,
          last_ai_run_at: new Date().toISOString(),
          status: isActive ? "active" : "cancelled",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,plaid_stream_id" }
      );

    if (upsertErr) {
      // eslint-disable-next-line no-console
      console.error("[scan] upsert failed", upsertErr);
      return;
    }

    onRow(monthlyEquivalentCents(row.amount_cents, row.frequency));
    await emit(scanId, { type: "row", scan_id: scanId, row });
  });

  await supabaseAdmin!
    .from("plaid_items")
    .update({ last_synced_at: new Date().toISOString(), needs_refresh: false })
    .eq("id", plaidItemRowId);
}

// ---------- helpers ----------

function normalizeFrequency(f: string | undefined): Frequency {
  switch ((f ?? "MONTHLY").toLowerCase()) {
    case "weekly":
      return "weekly";
    case "biweekly":
      return "biweekly";
    case "semi_monthly":
      return "semi_monthly";
    case "monthly":
      return "monthly";
    case "annually":
      return "annually";
    default:
      return "unknown";
  }
}

export function monthlyEquivalentCents(
  amount_cents: number,
  frequency: Frequency
): number {
  switch (frequency) {
    case "monthly":
      return amount_cents;
    case "annually":
      return Math.round(amount_cents / 12);
    case "weekly":
      return Math.round((amount_cents * 52) / 12);
    case "biweekly":
      return Math.round((amount_cents * 26) / 12);
    case "semi_monthly":
      return amount_cents * 2;
    default:
      return 0;
  }
}

// Regret score: months since last charge × monthly equivalent × frequency
// consistency. Bounded 0..100 so it sorts cleanly in SQL.
function regretScore(args: {
  amount_cents: number;
  frequency: Frequency;
  last_charged_at: string | null;
}): number {
  const monthly = monthlyEquivalentCents(args.amount_cents, args.frequency);
  const monthsSince = args.last_charged_at
    ? Math.max(
        0,
        (Date.now() - new Date(args.last_charged_at).getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      )
    : 1;
  const consistency = args.frequency === "unknown" ? 0.5 : 1;
  const raw = (monthly / 100 / 50) * monthsSince * consistency * 50;
  return Math.max(0, Math.min(100, Math.round(raw * 1000) / 1000));
}

async function runWithCap<T, R>(
  items: T[],
  cap: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += cap) {
    const chunk = items.slice(i, i + cap);
    const settled = await Promise.allSettled(chunk.map(worker));
    results.push(...settled);
  }
  return results;
}

async function emit(scanId: string, event: ScanEvent): Promise<void> {
  await publishScanEvent(scanId, event);
}

async function finalizeScan(
  scanId: string,
  userId: string,
  detected: number,
  failedItems: number,
  startedAtMs: number,
  status: "done" | "error" | "timeout"
) {
  const duration = Date.now() - startedAtMs;
  if (supabaseAdmin) {
    await supabaseAdmin
      .from("scan_runs")
      .update({
        finished_at: new Date().toISOString(),
        detected_count: detected,
        failed_items: failedItems,
        duration_ms: duration,
        status,
      })
      .eq("id", scanId);

    if (detected > 0 || failedItems === 0) {
      await supabaseAdmin
        .from("app_users")
        .update({ has_completed_scan: true })
        .eq("id", userId);
    }
  }
  await emit(scanId, {
    type: "complete",
    scan_id: scanId,
    detected,
    failed: failedItems,
    duration_ms: duration,
  });
}

async function seedSandboxFallback(
  userId: string,
  plaidItemRowId: string,
  scanId: string,
  onRow: (cents: number) => void
): Promise<number> {
  let detected = 0;
  const today = new Date();
  for (const sample of SANDBOX_FALLBACK_SUBS) {
    const lastCharged = new Date(today);
    lastCharged.setDate(today.getDate() - Math.floor(Math.random() * 28));
    const nextExpected = new Date(lastCharged);
    nextExpected.setMonth(lastCharged.getMonth() + 1);

    const row: ScanRow = {
      stream_id: `sandbox-fallback-${sample.merchant
        .toLowerCase()
        .replace(/\s+/g, "-")}`,
      merchant_name: sample.merchant,
      raw_descriptor: sample.merchant,
      amount_cents: sample.amount_cents,
      currency: "USD",
      frequency: sample.frequency,
      last_charged_at: lastCharged.toISOString().slice(0, 10),
      next_expected_charge_at: nextExpected.toISOString().slice(0, 10),
      regret_score: regretScore({
        amount_cents: sample.amount_cents,
        frequency: sample.frequency,
        last_charged_at: lastCharged.toISOString().slice(0, 10),
      }),
      category: "streaming",
      ai_source: "plaid",
    };

    const { error } = await supabaseAdmin!.from("subscriptions").upsert(
      {
        user_id: userId,
        plaid_item_id: plaidItemRowId,
        plaid_stream_id: row.stream_id,
        merchant_name: row.merchant_name,
        normalized_name: row.merchant_name,
        category: row.category,
        amount_cents: row.amount_cents,
        currency: row.currency,
        frequency: row.frequency,
        last_charged_at: row.last_charged_at,
        next_expected_charge_at: row.next_expected_charge_at,
        regret_score: row.regret_score,
        ai_source: row.ai_source,
        last_ai_run_at: new Date().toISOString(),
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,plaid_stream_id" }
    );

    if (!error) {
      detected += 1;
      onRow(monthlyEquivalentCents(row.amount_cents, row.frequency));
      await emit(scanId, { type: "row", scan_id: scanId, row });
    }
  }
  return detected;
}

export type { ScanRow, ScanPhase };
