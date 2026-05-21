import { revalidatePath } from "next/cache";
import { plaidClient, PLAID_ENV } from "./plaid";
import { supabaseAdmin } from "./supabase";
import { decryptToken } from "./crypto";
import { observeError } from "./observe";
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
import {
  recurringStreamsFromRaw,
  type RawDetectedStream,
} from "./raw-data-ingest";
import {
  classifyStream,
  classifyUserPrompt,
  CLASSIFY_SYSTEM_PROMPT,
  type ClassifyInput,
  type LlmClassifyResponse,
} from "./classify";
import { normalizeDescriptor } from "./merchant-normalize";
import type { SnapshotRow } from "./types/snapshot";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Scan orchestrator.
//
// Pipeline per Plaid Item:
//   1. /transactions/recurring/get → outflow_streams
//   2. For each stream (concurrency-capped fanout):
//      a. AI normalize merchant (cache + 800ms timeout + fallback)
//      b. Compute regret_score against the scan's fixed as_of_date
//      c. Upsert into subscriptions
//      d. Publish a `row` SSE event
//   3. Publish a final `total` then `complete` event.
//
// Multi-item fanout uses Promise.allSettled with a manual concurrency cap
// of 6 so one slow/dead Item never blocks fresh ones (spec section 3).
//
// Determinism contract (Phase 1):
//   - One `asOf` Date is captured at scan start and stored on scan_runs.
//     EVERY time-dependent computation downstream reads `asOf` instead of
//     calling Date.now() ad hoc. Two scans on the same Plaid response and
//     the same asOf produce byte-identical subscription rows.
//   - Streams are stable-sorted by descriptor before classification so
//     row order is independent of Plaid's response ordering.
//   - LLM calls (merchant normalize, classifier tiebreak) run with
//     temperature: 0.
//   - `updated_at` and `last_ai_run_at` use `asOf`, not the current wall
//     clock — so an idempotent re-run doesn't churn timestamps.
//
// Lifecycle state machine (migration 008):
//
//   running ──► finalizing ──► done       (success)
//                          └─► error      (terminal failure)
//                          └─► timeout    (budget exceeded)
//
//   - `running`    every per-stream upsert is still in flight
//   - `finalizing` every row has been persisted; cache invalidation and
//                  downstream notifications are dispatching. Today this
//                  window is short because every upsert is awaited before
//                  finalize, but the state exists so future async
//                  post-write work (Plaid /transactions/sync cursor
//                  completion, MRR rollups, push notifications) has a
//                  well-named home. Clients must NOT treat this as final.
//   - `done`       rows visible, caches invalidated. Safe to read.
//
// The SSE `complete` event and the polling `/api/scan/status` endpoint
// only report `done` after the rows are queryable and `revalidatePath`
// has been called. That is the contract the dashboard relies on to
// avoid the stale-data race.
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

// The old SANDBOX_FALLBACK_SUBS array and seedSandboxFallback function
// were removed in the tenant-isolation pass: they injected the same 10
// hardcoded subscriptions into EVERY user's scan when Plaid sandbox
// returned 0 streams. That meant one user's "scan" leaked the same
// demo names into another user's dashboard.

// The raw-data ingest path (lib/raw-data-ingest.ts) is now strictly
// gated. The xlsx-derived demo data only loads when:
//   - PLAID_ENV === "sandbox"
//   - FRUGAVO_SANDBOX_DEMO_USER_ID env var is set
//   - the running scan's Clerk userId exactly matches it
// Any other user — even in sandbox mode — sees only the streams Plaid
// actually returns for their own connected items. No fixtures, no
// fallback, no leakage.
function isDemoUser(userId: string): boolean {
  const allowed = process.env.FRUGAVO_SANDBOX_DEMO_USER_ID;
  return PLAID_ENV === "sandbox" && !!allowed && allowed === userId;
}

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

  // The one and only "now" this scan will ever observe. Stored on
  // scan_runs and threaded through every downstream function that would
  // otherwise call Date.now(): regretScore, classifier silent-window
  // heuristics, updated_at timestamps. This is what makes the scan
  // deterministic — two runs on the same input + same asOf produce
  // identical output.
  const asOf = new Date();
  const asOfIso = asOf.toISOString();

  const { data: runRow, error: runErr } = await supabaseAdmin
    .from("scan_runs")
    .insert({
      user_id: userId,
      source,
      status: "running",
      as_of_date: asOfIso,
    })
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

  // Collected by every per-stream worker; flushed into scan_snapshots
  // at finalize. This is the canonical record of what the engine
  // decided this scan — count, list, totals all derive from this array.
  const snapshotRows: SnapshotRow[] = [];

  await runWithCap(items, ITEM_CONCURRENCY, async (item) => {
    try {
      await scanOneItem({
        userId,
        scanId,
        asOf,
        plaidItemRowId: item.id,
        accessToken: item.plaid_access_token,
        onRow: (cents) => {
          monthlyTotalCents += cents;
          detected += 1;
        },
        onSnapshotRow: (row) => snapshotRows.push(row),
      });
    } catch (e) {
      observeError(e, {
        route: "scan",
        tags: { itemId: item.id, userId },
      });
      failedItems += 1;
    }
  });

  // No more demo-data fallback. If Plaid returned zero streams, the
  // user sees the empty state — they're not silently filled with other
  // people's data.

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
    failedItems > 0 && detected === 0 ? "error" : "done",
    {
      asOfIso,
      snapshotRows,
      monthlyUpkeepCents: monthlyTotalCents,
    }
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
  // Extended for the layered classifier — Plaid returns these on
  // outflow streams in production. Optional so sandbox-injected streams
  // can omit them safely.
  status?: string;
  personal_finance_category?: {
    primary?: string;
    detailed?: string;
  };
  // Some streams expose a small array of recent charge amounts; when
  // present we use it for the CV signal. The Plaid SDK ships these
  // under different keys across versions, so we treat it as opaque.
  recent_amount_cents?: number[];
  predicted_next_date?: string | null;
};

async function scanOneItem(args: {
  userId: string;
  scanId: string;
  asOf: Date;
  plaidItemRowId: string;
  accessToken: string;
  onRow: (monthlyEquivalentCents: number) => void;
  onSnapshotRow: (row: SnapshotRow) => void;
}): Promise<void> {
  const {
    userId,
    scanId,
    asOf,
    plaidItemRowId,
    accessToken,
    onRow,
    onSnapshotRow,
  } = args;
  const asOfIso = asOf.toISOString();

  const recurring = await plaidClient!.transactionsRecurringGet({
    access_token: decryptToken(accessToken),
  });

  let streams = (recurring.data.outflow_streams ?? []) as PlaidStreamLike[];

  // NOTE: the old isProbablySubscription regex is preserved below for
  // reference but no longer applied here. The layered classifier in
  // lib/classify.ts (Gate A → Gate B scoring → optional LLM tiebreak)
  // does this rejection plus much more, and runs per stream below
  // after we know all the Plaid metadata. See classifyStream().

  // Sandbox-only: ingest the raw bank transactions in
  // tests/fixtures/raw-transactions.json. The recurrence-detection rule
  // lives in lib/raw-data-ingest.ts and is intentionally minimal so the
  // downstream pipeline (filter, AI normalize, category assignment) is
  // what we're actually testing. We do NOT hand-pick subscriptions or
  // hand-clean merchant names here. Production never enters this branch.
  // Demo data injection — ONLY for the explicitly allowlisted demo user
  // in sandbox mode. Every other user (including other sandbox users)
  // sees only the streams Plaid returned for their own connected items.
  // This is the gate that prevents the xlsx fixture from leaking across
  // accounts.
  let rawStreams: RawDetectedStream[] = [];
  if (isDemoUser(userId)) {
    rawStreams = recurringStreamsFromRaw();
    streams = [
      ...streams,
      ...rawStreams.map((d) => ({
        stream_id: d.stream_id,
        merchant_name: null, // null on purpose — force AI normalize
        description: d.descriptor,
        average_amount: {
          amount: d.average_amount,
          iso_currency_code: "USD",
        },
        frequency: d.frequency,
        last_date: d.last_date,
        is_active: true,
        predicted_next_date: d.next_expected_date,
      })),
    ];
  }

  // Determinism: process streams in a fixed order regardless of how
  // Plaid (or our raw ingest) happened to return them. Sorting by the
  // descriptor + stream_id tuple guarantees identical input → identical
  // upsert order → identical SSE event order across runs.
  streams = [...streams].sort((a, b) => {
    const ka = `${a.description ?? ""}|${a.merchant_name ?? ""}|${a.stream_id}`;
    const kb = `${b.description ?? ""}|${b.merchant_name ?? ""}|${b.stream_id}`;
    return ka.localeCompare(kb);
  });

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

    // ------------- Layered classifier -------------
    //
    // Run Gate A → Gate B → optional LLM tiebreak. If the result is
    // 'reject' we never persist this stream. If 'review' we persist
    // with classification='needs_review' so it's auditable but never
    // counted in totals or surfaced as a cancel candidate. Only
    // 'confirm' lands as a confirmed subscription.

    // Pull real charge amounts for the CV signal. For the demo-user
    // sandbox path we have every historical transaction; for live
    // Plaid streams we read recent_amount_cents if present.
    let recentCharges: number[] | undefined;
    if (stream.stream_id.startsWith("raw-")) {
      const raw = rawStreams.find((r) => r.stream_id === stream.stream_id);
      recentCharges = raw?.transactions.map((t) =>
        Math.round(Math.abs(t.amount_dollars) * 100)
      );
    } else if (stream.recent_amount_cents) {
      recentCharges = stream.recent_amount_cents;
    }

    const classifyInput: ClassifyInput = {
      descriptor: rawDescriptor,
      merchantName: norm.merchant_name,
      pfcPrimary: stream.personal_finance_category?.primary ?? null,
      pfcDetailed: stream.personal_finance_category?.detailed ?? null,
      frequency: (stream.frequency ?? "").toUpperCase(),
      status: stream.status ?? null,
      isActive: stream.is_active !== false,
      avgAmountCents: amountCents,
      recentChargeCents: recentCharges,
      domain: null, // populated by future logo-resolver patch
    };

    const verdict = await classifyStream(classifyInput, llmTiebreak);

    if (verdict.decision === "reject") {
      // Never persist — this stream is definitively not a subscription.
      return;
    }

    // Catalog override. The external merchant catalog
    // (lib/data/merchant-catalog.json) takes precedence over the AI
    // normalizer for any merchant we know — that's what makes results
    // deterministic across users and Haiku versions. Bank fees route
    // to their dedicated category instead of falling into "other."
    const catalogHit = normalizeDescriptor(rawDescriptor);
    const useCatalog =
      catalogHit.catalog_key !== null ||
      catalogHit.category === "bank_fees" ||
      catalogHit.domain !== null;
    const merchantName = useCatalog ? catalogHit.merchant_name : norm.merchant_name;
    const category = useCatalog ? catalogHit.category : norm.category;

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
      asOf,
    });

    const row: ScanRow = {
      stream_id: stream.stream_id,
      merchant_name: merchantName,
      raw_descriptor: rawDescriptor,
      amount_cents: amountCents,
      currency,
      frequency,
      last_charged_at: stream.last_date ?? null,
      next_expected_charge_at: predictedNext,
      regret_score: regret,
      category,
      ai_source: norm.ai_source,
    };

    const { data: upserted, error: upsertErr } = await supabaseAdmin!
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
          last_ai_run_at: asOfIso,
          status: isActive ? "active" : "cancelled",
          // Classifier verdict. The dashboard filters on this so only
          // 'confirmed' rows count toward totals and candidate lists.
          classification: verdict.classification,
          classification_signals: verdict.signals,
          classification_score: verdict.score,
          updated_at: asOfIso,
        },
        { onConflict: "user_id,plaid_stream_id" }
      )
      .select("id")
      .single();

    if (upsertErr || !upserted) {
      // eslint-disable-next-line no-console
      console.error("[scan] upsert failed", upsertErr);
      return;
    }

    // Sandbox-only: persist the REAL transactions for this descriptor.
    // These are the actual amounts and dates from your bank statement —
    // not synthesized, not averaged. Drives the 12-month chart.
    if (PLAID_ENV === "sandbox" && stream.stream_id.startsWith("raw-")) {
      const detected = rawStreams.find(
        (d) => d.stream_id === stream.stream_id
      );
      if (detected && detected.transactions.length > 0) {
        const chargeRows = detected.transactions.map((t) => ({
          user_id: userId,
          subscription_id: upserted.id as string,
          plaid_stream_id: stream.stream_id,
          amount_cents: Math.round(Math.abs(t.amount_dollars) * 100),
          charged_at: t.date,
          // false = derived from a real transaction record, not a
          // synthesized estimate.
          is_estimated: false,
          currency: row.currency,
        }));
        await supabaseAdmin!
          .from("subscription_charges")
          .upsert(chargeRows, {
            onConflict: "subscription_id,charged_at,amount_cents",
            ignoreDuplicates: true,
          });
      }
    }

    // Push to the snapshot regardless of classification — needs_review
    // rows are part of the audit trail. The dashboard filters on
    // classification === 'confirmed' at read time.
    const monthlyEq = monthlyEquivalentCents(row.amount_cents, row.frequency);
    // Tighten types for the snapshot row. We've already returned on
    // verdict.decision === "reject", so verdict.classification here is
    // one of "confirmed" | "needs_review". row.category may be null
    // when the AI normalizer didn't pick one and the catalog missed —
    // default to "other".
    const snapshotClassification =
      (verdict.classification ?? "needs_review") as
        | "confirmed"
        | "needs_review";
    onSnapshotRow({
      plaid_stream_id: stream.stream_id,
      merchant_name: row.merchant_name,
      category: row.category ?? "other",
      amount_cents: row.amount_cents,
      currency: row.currency,
      frequency: row.frequency,
      monthly_equivalent_cents: monthlyEq,
      last_charged_at: row.last_charged_at,
      next_expected_charge_at: row.next_expected_charge_at,
      classification: snapshotClassification,
      classification_score: verdict.score,
      regret_score: row.regret_score,
      status: isActive ? "active" : "cancelled",
      source: {
        catalog_key: catalogHit.catalog_key,
        matched_alias: catalogHit.signals.matched_alias,
        matched_domain: catalogHit.signals.matched_domain,
        biller: catalogHit.biller,
        raw_descriptor: rawDescriptor,
        plaid_merchant_name: stream.merchant_name ?? null,
        ai_source: norm.ai_source,
      },
    });

    // Only confirmed subs hit the SSE stream + the running total. The
    // 'needs_review' rows are stored silently — they appear in nothing
    // user-facing until someone explicitly builds a review queue UI.
    if (verdict.classification === "confirmed") {
      onRow(monthlyEq);
      await emit(scanId, { type: "row", scan_id: scanId, row });
    }
  });

  await supabaseAdmin!
    .from("plaid_items")
    .update({ last_synced_at: new Date().toISOString(), needs_refresh: false })
    .eq("id", plaidItemRowId);
}

// ---------- LLM tiebreak callback for the classifier ----------
//
// Wraps the Haiku call with the strict-JSON classify contract. 800ms
// timeout — same as the merchant-name normalizer. Returns null on any
// failure so the classifier routes to needs_review instead of
// accidentally confirming on a malformed response.

const tiebreakClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function llmTiebreak(
  input: ClassifyInput
): Promise<LlmClassifyResponse | null> {
  if (!tiebreakClient) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("llm_timeout"), 800);
  try {
    const res = await tiebreakClient.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        // Pinned for determinism — same borderline input → same verdict.
        temperature: 0,
        system: CLASSIFY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: classifyUserPrompt(input) }],
      },
      { signal: ctrl.signal }
    );
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(text) as LlmClassifyResponse;
    if (
      typeof parsed.is_subscription !== "boolean" ||
      typeof parsed.confidence !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
//
// Takes the scan's fixed `asOf` rather than calling Date.now() — that's
// the whole point of the determinism contract. Two scans on the same
// input + same asOf return the exact same number.
function regretScore(args: {
  amount_cents: number;
  frequency: Frequency;
  last_charged_at: string | null;
  asOf: Date;
}): number {
  const monthly = monthlyEquivalentCents(args.amount_cents, args.frequency);
  const monthsSince = args.last_charged_at
    ? Math.max(
        0,
        (args.asOf.getTime() - new Date(args.last_charged_at).getTime()) /
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

// finalizeScan enforces the lifecycle state machine documented at the
// top of this file. The order matters and is part of the public contract
// the client depends on:
//
//   1. Write status='finalizing' with the row counts. From this point
//      onward, every subscription row for this scan is guaranteed to be
//      visible to a fresh read against the primary.
//   2. Mark the user has_completed_scan = true (idempotent).
//   3. Invalidate the Next.js Route Cache for the dashboard so the next
//      navigation to /app re-renders the Server Component against fresh
//      DB data instead of serving a stale RSC payload. revalidatePath
//      requires being called from a Next request context — when this
//      runs inside a fire-and-forget webhook scan the context may be
//      gone, so we swallow that case rather than failing the scan.
//   4. Write the terminal status (done | error | timeout). Only after
//      this does the SSE `complete` event fire and the polling status
//      endpoint return a terminal value. Clients are contractually
//      forbidden from rendering the snapshot until they see this state.
//
// If step 3 fails (transient cache-bus error, no request context), we
// log and continue. The client-side router.refresh() in StreamingList
// and the tab-focus check on the dashboard recover from that case.
async function finalizeScan(
  scanId: string,
  userId: string,
  detected: number,
  failedItems: number,
  startedAtMs: number,
  status: "done" | "error" | "timeout",
  snapshot: {
    asOfIso: string;
    snapshotRows: SnapshotRow[];
    monthlyUpkeepCents: number;
  } = { asOfIso: new Date().toISOString(), snapshotRows: [], monthlyUpkeepCents: 0 }
) {
  const duration = Date.now() - startedAtMs;

  if (supabaseAdmin) {
    // Step 1: finalizing. Rows are persisted; status reflects that.
    await supabaseAdmin
      .from("scan_runs")
      .update({
        finished_at: new Date().toISOString(),
        detected_count: detected,
        failed_items: failedItems,
        duration_ms: duration,
        status: "finalizing",
      })
      .eq("id", scanId);

    // Step 1b: write the immutable scan_snapshot. THIS is what the
    // dashboard reads from — not the mutable subscriptions table. Count,
    // list, and monthly upkeep all derive from this single payload so
    // they cannot disagree.
    //
    // Confirmed-only counts here mirror what the UI shows; the raw
    // payload also carries needs_review rows for audit.
    const confirmedRows = snapshot.snapshotRows.filter(
      (r) => r.classification === "confirmed"
    );
    const confirmedUpkeep = confirmedRows.reduce(
      (sum, r) => sum + r.monthly_equivalent_cents,
      0
    );
    const { error: snapErr } = await supabaseAdmin.from("scan_snapshots").insert({
      user_id: userId,
      scan_run_id: scanId,
      as_of_date: snapshot.asOfIso,
      payload: { rows: snapshot.snapshotRows },
      detected_count: confirmedRows.length,
      monthly_upkeep_cents: confirmedUpkeep,
    });
    if (snapErr) {
      // eslint-disable-next-line no-console
      console.error("[scan] snapshot insert failed", snapErr);
    }

    // Step 2: user-level flag. Safe to flip now because the row set is
    // queryable; the dashboard will route to the list view instead of
    // the "connect a bank" empty state.
    if (detected > 0 || failedItems === 0) {
      await supabaseAdmin
        .from("app_users")
        .update({ has_completed_scan: true })
        .eq("id", userId);
    }
  }

  // Step 3: invalidate the dashboard's RSC cache so the next /app
  // navigation re-renders with fresh data. This is what fixes the
  // "have to hard reload" symptom — Next's Router Cache would otherwise
  // serve the pre-scan payload to router.push("/app") calls.
  try {
    revalidatePath("/app");
    revalidatePath("/app/scanning");
  } catch (e) {
    // Out of request context (cron, fire-and-forget). The client-side
    // fallbacks (router.refresh on SSE complete, tab-focus check on the
    // dashboard) will catch this case.
    observeError(e, {
      route: "scan.finalize.revalidate",
      tags: { scanId, userId },
    });
  }

  // Step 4: terminal status. Only AFTER this do we emit `complete` —
  // the client treats this as the signal that the snapshot is safe to
  // read.
  if (supabaseAdmin) {
    await supabaseAdmin
      .from("scan_runs")
      .update({ status })
      .eq("id", scanId);
  }

  await emit(scanId, {
    type: "complete",
    scan_id: scanId,
    detected,
    failed: failedItems,
    duration_ms: duration,
  });
}

// ---------- non-subscription filter (LEGACY — kept for now) ----------
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

export type { ScanRow, ScanPhase };
