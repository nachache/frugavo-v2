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

  let streams = (recurring.data.outflow_streams ?? []) as PlaidStreamLike[];

  // Filter out streams that are clearly not subscriptions — credit card
  // pay-downs, automatic transfers, payroll/loan repayments. Plaid's
  // recurring detector flags these as outflow streams because they ARE
  // recurring outflows, but they belong on a different surface (debts,
  // not subscriptions) and they confuse users when shown as cancellable.
  streams = streams.filter((s) => isProbablySubscription(s));

  // Sandbox-only: prepend a realistic synthetic fixture so the AI
  // normalization path actually gets exercised. Plaid sandbox only
  // returns ~7 generic-named streams which isn't enough to validate the
  // engine. Production never enters this branch.
  if (PLAID_ENV === "sandbox") {
    streams = [...streams, ...buildSyntheticSandboxStreams()];
  }

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

// ---------- non-subscription filter ----------
//
// Plaid's recurring detector returns any consistent outflow, including
// things that aren't really "subscriptions" — credit card auto-pays,
// loan repayments, internal transfers, payroll-related items. We filter
// them out before they ever reach the AI normalizer or the dashboard.
// Conservative: only drop on strong signal so we never hide a real sub.

const NON_SUBSCRIPTION_PATTERNS: RegExp[] = [
  /credit\s*card.*payment/i,        // "CREDIT CARD 3333 PAYMENT"
  /automatic\s*payment/i,            // "AUTOMATIC PAYMENT - THANK"
  /\bcc\s*payment\b/i,
  /loan\s*payment/i,
  /mortgage\s*payment/i,
  /auto\s*loan/i,
  /transfer\s*(to|from)/i,
  /\bpayroll\b/i,
  /\bach\s*deposit\b/i,
  /\bvenmo\s*cashout\b/i,
  /\bzelle\b/i,
];

function isProbablySubscription(s: PlaidStreamLike): boolean {
  const haystack = `${s.merchant_name ?? ""} ${s.description ?? ""}`.trim();
  if (!haystack) return false;
  for (const pattern of NON_SUBSCRIPTION_PATTERNS) {
    if (pattern.test(haystack)) return false;
  }
  return true;
}

// ---------- realistic synthetic streams for sandbox testing ----------
//
// These exercise the full pipeline: messy raw descriptors → AI
// normalization → category tagging → regret score. The descriptors
// mimic real bank statement strings (transaction ids, payment
// processors, locale codes) so we can verify the normalizer collapses
// them to clean brand names.

function buildSyntheticSandboxStreams(): PlaidStreamLike[] {
  const today = new Date();
  const daysAgo = (n: number): string =>
    new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);

  const make = (
    id: string,
    description: string,
    plaidMerchant: string | null,
    amount: number,
    daysSince: number,
    frequency: string = "MONTHLY"
  ): PlaidStreamLike => ({
    stream_id: `syn-${id}`,
    merchant_name: plaidMerchant,
    description,
    average_amount: { amount, iso_currency_code: "USD" },
    frequency,
    last_date: daysAgo(daysSince),
    is_active: true,
  });

  return [
    make("netflix",  "SP AFF*NETFLIX 866-579-7172 CA", "Netflix", 22.99, 4),
    make("spotify",  "SPOTIFY USA 877-7787-9", "Spotify", 11.99, 9),
    make("amzn-prime","AMZN PRIME*RX49J3DM1 WA", "Amazon", 14.99, 14),
    make("adobe-cc", "ADOBE *CREATIVECLOUD 408-536", "Adobe", 59.99, 7),
    make("nyt",      "NYTimes*Subscription NY", "The New York Times", 25.00, 11),
    make("hbo-max",  "HBOMAX*PLAYTI XX5839", null, 15.99, 6),
    make("disney",   "DISNEY PLUS BURBANK CA", "Disney+", 13.99, 19),
    make("youtube-prem", "GOOGLE *YOUTUBE PRE g.co/he", null, 13.99, 2),
    make("icloud",   "APPLE.COM/BILL 866-712-7753", "Apple", 9.99, 22),
    make("audible",  "AUDIBLE*HG3J29 amzn.com/bill", "Audible", 14.95, 17),
    make("dropbox",  "DROPBOX*1NJK39DJ DUBLIN", "Dropbox", 11.99, 12),
    make("notion",   "NOTION LABS INC SF CA", "Notion", 10.00, 8),
    make("linkedin", "LINKEDIN-PREMIUM 855-65", "LinkedIn", 39.99, 24),
    make("peloton",  "PELOTON*MEMBERSHIP NY", "Peloton", 44.00, 3),
    make("strava",   "STRAVA INC SAN FRANCIS", "Strava", 11.99, 13),
    make("classpass","CLASSPASS INC NEW YORK", null, 99.00, 27),
    make("hellofresh","HelloFresh*78293DJ NY", "HelloFresh", 89.94, 5),
    make("doordash-dash","DOORDASH *DashPass SF", null, 9.99, 16),
    make("att",      "ATT*BILL PAYMENT 800-2", "AT&T", 75.00, 20),
    make("verizon",  "VZWRLSS*APOCC VISN 800-922", "Verizon", 95.00, 1),
    make("github",   "GITHUB INC 877-448-4820", "GitHub", 4.00, 10),
    make("openai",   "OPENAI *CHATGPT PLUS SF", null, 20.00, 5),
    make("anthropic","ANTHROPIC PBC SAN FRAN", "Anthropic", 20.00, 15),
    make("nyt-cooking","NYTimes*Cooking 800-69", null, 5.00, 21),
    make("nintendo", "NINTENDO ONLINE FAMILY", "Nintendo", 34.99, 60, "ANNUALLY"),
    make("amazon-music","Amazon Music*RT82J SE", "Amazon", 10.99, 8),
    make("squarespace","SQUARESPACE INC NY 646-69", "Squarespace", 23.00, 18),
  ];
}

export type { ScanRow, ScanPhase };
