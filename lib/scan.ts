import { revalidatePath } from "next/cache";
import { plaidClient } from "./plaid";
import { supabaseAdmin } from "./supabase";
import { observeError } from "./observe";
import { normalizeMerchant } from "@/lib/ai/normalize";
import {
  publishScanEvent,
  cacheKey,
  tryAcquireLock,
} from "@/lib/cache";
import type {
  Frequency,
  ScanEvent,
  ScanRow,
  ScanPhase,
  AiSource,
} from "@/lib/types/scan";
import {
  classifyStream,
  classifyUserPrompt,
  CLASSIFY_SYSTEM_PROMPT,
  type ClassifyInput,
  type LlmClassifyResponse,
} from "./classify";
import { normalizeDescriptor } from "./merchant-normalize";
import type { SnapshotRow } from "./types/snapshot";
import { SCANNER_VERSION } from "./scanner-version";
import { subscriptionKey } from "./subscription-key";
import { syncAllItemsForUser } from "./plaid-sync";
import {
  detectRecurringStreams,
  cadenceToFrequency,
  type TxnInput,
  type DetectedStream,
} from "./recurrence-detect";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Scan orchestrator — owned-detection architecture.
//
// Pipeline (single path; no demo/sandbox branching):
//   1. Acquire per-user lock + capture as_of_date.
//   2. INSERT scan_runs (status='running', scanner_version, as_of_date).
//   3. Sync every active plaid_item via /transactions/sync. Cursor on
//      plaid_items advances incrementally; plaid_transactions is the
//      authoritative store.
//   4. Read all enriched transactions (already carry merchant_key,
//      canonical_name, normalized_descriptor — populated by sync).
//   5. Run pure detectRecurringStreams() — deterministic; same input +
//      same params = identical output.
//   6. Optional enrichment: Plaid /transactions/recurring/get is fetched
//      ONLY as a secondary signal source (status, PFC). It NEVER drives
//      which streams exist or what they look like — that's owned by us.
//   7. Per detected stream: classify (Gate A → B → optional LLM
//      tiebreak), compute subscription_key, upsert subscriptions on
//      (user_id, subscription_key), build SnapshotRow.
//   8. finalizeScan: append-only scan_snapshot, revalidatePath, terminal
//      status, SSE complete.
//
// Determinism contract:
//   - Single as_of captured at scan start.
//   - detectRecurringStreams is pure.
//   - Catalog-first normalization. Haiku ONLY on catalog miss, temp 0.
//   - LLM is never on the path of recurrence math, money math, or dates.
//   - Stable subscription identity via subscription_key (hash of
//     user_id + merchant_key). User decisions survive descriptor drift.
//   - scanner_version stamped on every scan_run, scan_snapshot, and
//     subscription row for replay verification.
// ---------------------------------------------------------------------------

const ROW_CONCURRENCY = 8;

export type ScanResult = {
  scan_id: string;
  detected: number;
  failedItems: number;
  duration_ms: number;
  error?: string;
};

export type ScanSource = "plaid" | "webhook" | "manual" | "first_connect";

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

  // Per-user lock prevents two concurrent scans from racing the same
  // plaid_items.cursor advancement.
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

  // Single "now" for this scan. Every time-dependent computation reads
  // this instead of Date.now() so replay is reproducible.
  const asOf = new Date();
  const asOfIso = asOf.toISOString();

  const { data: runRow, error: runErr } = await supabaseAdmin
    .from("scan_runs")
    .insert({
      user_id: userId,
      source,
      status: "running",
      as_of_date: asOfIso,
      scanner_version: SCANNER_VERSION,
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

  // ---- Step 1: sync every item's transactions via /transactions/sync ----
  let syncMetrics = { items: 0, added: 0, modified: 0, removed: 0, pages: 0 };
  try {
    const sync = await syncAllItemsForUser(userId);
    syncMetrics = {
      items: sync.items,
      added: sync.result.added,
      modified: sync.result.modified,
      removed: sync.result.removed,
      pages: sync.result.pages,
    };
  } catch (e) {
    observeError(e, { route: "scan.sync", tags: { userId } });
  }

  await emit(scanId, { type: "progress", scan_id: scanId, phase: "reading" });

  // ---- Step 2: read stored transactions for this user ----
  const txns = await readStoredTransactions(userId);

  // ---- Step 3: optional Plaid /transactions/recurring/get enrichment ----
  // Fetched once per item. Only used for PFC + status hints on
  // matching merchant_keys. NEVER drives stream membership.
  const enrichment = await fetchPlaidRecurringEnrichment(userId);

  // ---- Step 4: deterministic detection ----
  const { streams: detected, audits } = detectRecurringStreams(txns);

  // Debug instrumentation. Gated on FRUGAVO_SCAN_DEBUG_USER_ID matching
  // the scanning user — single-user opt-in so we can investigate one
  // account in detail without flooding logs in production.
  if (
    process.env.FRUGAVO_SCAN_DEBUG_USER_ID &&
    process.env.FRUGAVO_SCAN_DEBUG_USER_ID === userId
  ) {
    // eslint-disable-next-line no-console
    console.log(
      `[scan:debug] user=${userId} scan=${scanId} txns=${txns.length} groups=${audits.length} accepted=${detected.length}`
    );
    for (const a of audits) {
      // eslint-disable-next-line no-console
      console.log(
        `[scan:debug] ${a.decision} key=${a.merchant_key} desc="${a.representative_descriptor.slice(0, 60)}" raw=${a.raw_count} kept=${a.kept_count} drift_out=${a.outlier_count} median_gap=${a.median_gap_days}d median_amt=$${a.median_amount_dollars.toFixed(2)} cadence=${a.cadence ?? "none"} reason=${a.rejection_reason ?? "ok"}${a.required_occurrences ? ` need>=${a.required_occurrences}` : ""}`
      );
    }
  }

  await emit(scanId, { type: "progress", scan_id: scanId, phase: "spotting" });

  // ---- Step 5: classify + persist each detected stream ----
  let monthlyTotalCents = 0;
  let detectedConfirmed = 0;
  const snapshotRows: SnapshotRow[] = [];
  let llmCalls = 0;
  let catalogHits = 0;

  // Process in stable order. detectRecurringStreams already sorts by
  // merchant_key but we re-pin here to make the contract explicit.
  const orderedStreams = [...detected].sort((a, b) =>
    a.merchant_key.localeCompare(b.merchant_key)
  );

  // Cap concurrency. Each per-stream task is bounded by the classifier
  // tiebreak Haiku call (800ms timeout).
  await runWithCap(orderedStreams, ROW_CONCURRENCY, async (stream) => {
    const result = await processDetectedStream({
      userId,
      scanId,
      asOf,
      stream,
      enrichment,
    });
    if (!result) return;
    if (result.aiSource === "catalog") catalogHits++;
    if (result.aiSource === "llm") llmCalls++;
    if (result.classification === "confirmed") {
      monthlyTotalCents += result.monthlyEquivalentCents;
      detectedConfirmed++;
      await emit(scanId, { type: "row", scan_id: scanId, row: result.scanRow });
    }
    snapshotRows.push(result.snapshotRow);
  });

  await emit(scanId, {
    type: "total",
    scan_id: scanId,
    monthly_cents: monthlyTotalCents,
    count: detectedConfirmed,
  });

  await finalizeScan(
    scanId,
    userId,
    detectedConfirmed,
    0, // no per-item failure model anymore; sync failures are logged but non-fatal
    t0,
    "done",
    {
      asOfIso,
      snapshotRows,
      monthlyUpkeepCents: monthlyTotalCents,
      metrics: {
        sync: syncMetrics,
        catalog_hits: catalogHits,
        llm_calls: llmCalls,
        detected_total: detected.length,
        confirmed: detectedConfirmed,
      },
    }
  );

  return {
    scan_id: scanId,
    detected: detectedConfirmed,
    failedItems: 0,
    duration_ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Per-stream processor.
//
// Pulls catalog metadata, runs classifier, computes subscription_key,
// upserts the live subscriptions row, and builds the snapshot row.
// ---------------------------------------------------------------------------

type ProcessResult = {
  classification: "confirmed" | "needs_review";
  aiSource: AiSource;
  monthlyEquivalentCents: number;
  scanRow: ScanRow;
  snapshotRow: SnapshotRow;
};

async function processDetectedStream(args: {
  userId: string;
  scanId: string;
  asOf: Date;
  stream: DetectedStream;
  enrichment: Map<string, EnrichmentRecord>;
}): Promise<ProcessResult | null> {
  const { userId, scanId, asOf, stream, enrichment } = args;
  const asOfIso = asOf.toISOString();

  // ---- Catalog-first normalization ----
  // detectRecurringStreams already stored merchant_key + canonical_name.
  // We re-run normalizeDescriptor on the representative descriptor to
  // get category + biller info (cheap, in-memory, deterministic).
  const catalogHit = normalizeDescriptor(stream.representative_descriptor);
  const catalogResolved =
    catalogHit.catalog_key !== null ||
    catalogHit.category === "bank_fees" ||
    catalogHit.domain !== null;

  let merchantName: string;
  let category: string;
  let aiSource: AiSource;

  if (catalogResolved) {
    merchantName = catalogHit.merchant_name;
    category = catalogHit.category;
    aiSource = "catalog";
  } else {
    // Catalog miss → Haiku, temp 0. Caches in Redis 30d.
    const amountCents = Math.round(stream.average_amount_dollars * 100);
    const norm = await normalizeMerchant(
      {
        raw_descriptor: stream.representative_descriptor,
        plaid_merchant_name: stream.canonical_name,
        amount_cents: amountCents,
        frequency: cadenceToFrequency(stream.frequency),
      },
      { userId, scanRunId: scanId }
    );
    merchantName = norm.merchant_name || stream.canonical_name;
    category = norm.category ?? "other";
    aiSource = norm.ai_source;
  }

  // ---- Enrichment lookup (Plaid recurring as secondary signal) ----
  // Plaid recurring/get is best-effort. The PRIMARY pfc signal now comes
  // from the stored transactions, which detectRecurringStreams already
  // attached to the detected stream. Enrichment overrides only if Plaid
  // recognized the stream and has its own (richer) categorization.
  const enrich = enrichment.get(stream.merchant_key);
  const pfcPrimary = enrich?.pfc_primary ?? stream.pfc_primary;
  const pfcDetailed = enrich?.pfc_detailed ?? stream.pfc_detailed;

  const frequency = cadenceToFrequency(stream.frequency);
  const amountCents = Math.round(stream.average_amount_dollars * 100);

  // ---- Classifier ----
  const classifyInput: ClassifyInput = {
    descriptor: stream.representative_descriptor,
    merchantName,
    pfcPrimary,
    pfcDetailed,
    // Detection cadence enum maps directly to Plaid's frequency enum;
    // classifier expects upper-case.
    frequency: stream.frequency,
    // We own grouping now. "MATURE" reflects the engine's confidence:
    // 3+ on-cadence charges + drift tolerance passed.
    status: enrich?.status ?? "MATURE",
    isActive: true,
    avgAmountCents: amountCents,
    recentChargeCents: stream.transactions.map((t) =>
      Math.round(Math.abs(t.amount_dollars) * 100)
    ),
    domain: catalogHit.domain ?? null,
  };

  const verdict = await classifyStream(classifyInput, llmTiebreak);
  if (verdict.decision === "reject") return null;
  if (!verdict.classification) return null;

  // ---- Stable identity ----
  const subKey = subscriptionKey(userId, stream.merchant_key);

  // ---- regret_score against fixed as_of ----
  const regret = regretScore({
    amount_cents: amountCents,
    frequency,
    last_charged_at: stream.last_date,
    asOf,
  });

  const monthlyEq = monthlyEquivalentCents(amountCents, frequency);

  // ---- Upsert into subscriptions on (user_id, subscription_key) ----
  // User decisions live on this table and survive across scans because
  // subscription_key is stable.
  const { data: upserted, error: upsertErr } = await supabaseAdmin!
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        // plaid_item_id and plaid_stream_id are nullable now — we
        // group by merchant_key, not by Plaid's stream identity.
        plaid_item_id: null,
        plaid_stream_id: null,
        subscription_key: subKey,
        merchant_name: merchantName,
        normalized_name: merchantName,
        canonical_name: stream.canonical_name,
        merchant_key: stream.merchant_key,
        normalized_descriptor: stream.normalized_descriptor,
        raw_descriptor: stream.representative_descriptor,
        category,
        amount_cents: amountCents,
        currency: stream.currency,
        frequency,
        last_charged_at: stream.last_date,
        next_expected_charge_at: stream.next_expected_date,
        regret_score: regret,
        ai_source: aiSource,
        last_ai_run_at: asOfIso,
        status: "active",
        classification: verdict.classification,
        classification_signals: verdict.signals,
        classification_score: verdict.score,
        scanner_version: SCANNER_VERSION,
        updated_at: asOfIso,
      },
      { onConflict: "user_id,subscription_key" }
    )
    .select("id")
    .single();

  if (upsertErr || !upserted) {
    // eslint-disable-next-line no-console
    console.error("[scan] subscriptions upsert failed", upsertErr);
    return null;
  }

  // ---- Phase 4: write subscription_charges (real billing history) ----
  // Both kept (accepted) and drift-rejected (outlier) charges are
  // linked to this subscription. Outliers are real money — taxes, FX
  // drift, annual true-ups — and stay visible in history with a
  // status flag the UI can render as "unusual charge".
  //
  // Idempotent on (user_id, subscription_id, plaid_transaction_id).
  // Failure here does NOT abort the scan; the subscription row is
  // still valid, we just have incomplete history for this run.
  await writeSubscriptionCharges({
    userId,
    subscriptionId: upserted.id as string,
    scanId,
    stream,
    confidence: verdict.score,
  });

  const scanRow: ScanRow = {
    stream_id: subKey,
    merchant_name: merchantName,
    raw_descriptor: stream.representative_descriptor,
    amount_cents: amountCents,
    currency: stream.currency,
    frequency,
    last_charged_at: stream.last_date,
    next_expected_charge_at: stream.next_expected_date,
    regret_score: regret,
    category,
    ai_source: aiSource,
  };

  const snapshotRow: SnapshotRow = {
    plaid_stream_id: subKey,
    merchant_name: merchantName,
    category,
    amount_cents: amountCents,
    currency: stream.currency,
    frequency,
    monthly_equivalent_cents: monthlyEq,
    last_charged_at: stream.last_date,
    next_expected_charge_at: stream.next_expected_date,
    classification: verdict.classification,
    classification_score: verdict.score,
    regret_score: regret,
    status: "active",
    source: {
      catalog_key: catalogHit.catalog_key,
      matched_alias: catalogHit.signals.matched_alias,
      matched_domain: catalogHit.signals.matched_domain,
      biller: catalogHit.biller,
      raw_descriptor: stream.representative_descriptor,
      plaid_merchant_name: stream.canonical_name,
      ai_source: aiSource,
    },
  };

  return {
    classification: verdict.classification,
    aiSource,
    monthlyEquivalentCents: monthlyEq,
    scanRow,
    snapshotRow,
  };
}

// ---------------------------------------------------------------------------
// Phase 4: subscription_charges writer.
//
// Writes the per-transaction billing history for a single detected
// stream. Called once per accepted subscription, immediately after the
// subscriptions upsert.
//
// Determinism contract:
//   - Accepted (in-cadence) charges are written in chronological order
//     with cadence_cycle_id = 1..N.
//   - Outlier charges are written with cadence_cycle_id = NULL.
//   - matched_by = "biller_tier" when the merchant_key carries the
//     amount-bucket suffix (Apple / PayPal / Google Play passthrough),
//     otherwise "merchant_key".
//
// Idempotency: upsert on (user_id, subscription_id, plaid_transaction_id).
// Re-scans overwrite confidence, scan_run_id, scanner_version and
// detector_status — useful when a charge moves from "kept" → "outlier"
// across engine versions, which is the whole point of the replay
// guarantee.
// ---------------------------------------------------------------------------

export async function writeSubscriptionCharges(args: {
  userId: string;
  subscriptionId: string;
  scanId: string;
  stream: DetectedStream;
  confidence: number;
}): Promise<void> {
  if (!supabaseAdmin) return;

  const { userId, subscriptionId, scanId, stream, confidence } = args;

  // Detect biller-tier matching by inspecting the merchant_key. The
  // tier suffix is appended in lib/plaid-sync.ts buildTxnRow only when
  // norm.biller_passthrough is true.
  const isBillerTier = /_t\d+$/.test(stream.merchant_key);
  const matchedBy: "merchant_key" | "biller_tier" = isBillerTier
    ? "biller_tier"
    : "merchant_key";

  // Accepted charges, sorted ascending by date so cycle_id is stable
  // across runs (the detector already returns them ordered, but defend
  // against future refactors).
  const accepted = [...stream.transactions].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const rows = [
    ...accepted.map((t, idx) => ({
      user_id: userId,
      subscription_id: subscriptionId,
      plaid_transaction_id: t.txn_id,
      posted_date: t.date,
      amount_cents: Math.round(Math.abs(t.amount_dollars) * 100),
      currency: t.currency || "USD",
      raw_descriptor: t.raw_descriptor,
      merchant_key: t.merchant_key,
      detector_status: "accepted" as const,
      matched_by: matchedBy,
      confidence,
      cadence_cycle_id: idx + 1,
      scan_run_id: scanId,
      scanner_version: SCANNER_VERSION,
    })),
    ...stream.outliers.map((t) => ({
      user_id: userId,
      subscription_id: subscriptionId,
      plaid_transaction_id: t.txn_id,
      posted_date: t.date,
      amount_cents: Math.round(Math.abs(t.amount_dollars) * 100),
      currency: t.currency || "USD",
      raw_descriptor: t.raw_descriptor,
      merchant_key: t.merchant_key,
      detector_status: "outlier" as const,
      matched_by: matchedBy,
      confidence,
      cadence_cycle_id: null,
      scan_run_id: scanId,
      scanner_version: SCANNER_VERSION,
    })),
  ];

  if (rows.length === 0) return;

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("subscription_charges")
      .upsert(chunk, {
        onConflict: "user_id,subscription_id,plaid_transaction_id",
        ignoreDuplicates: false,
      });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[scan] subscription_charges upsert failed", {
        subscriptionId,
        merchant_key: stream.merchant_key,
        rows: chunk.length,
        error: error.message,
      });
      // Continue to next chunk — partial history beats none.
    }
  }
}

// ---------------------------------------------------------------------------
// Stored transaction read.
// ---------------------------------------------------------------------------

async function readStoredTransactions(userId: string): Promise<TxnInput[]> {
  if (!supabaseAdmin) return [];

  // Supabase PostgREST caps single requests at 1000 rows by default
  // (db.max-rows). A user with >1000 outflows would silently lose the
  // tail of their history, which is exactly the long-running annual
  // and quarterly subscriptions the engine needs.
  //
  // Page through with .range() until we get a short page.
  const PAGE = 1000;
  const out: TxnInput[] = [];
  let offset = 0;

  // Hard ceiling so a runaway loop can't lock the function — 100k txns
  // is well beyond any sane personal-banking history window.
  const HARD_CEILING = 100_000;

  while (offset < HARD_CEILING) {
    const { data, error } = await supabaseAdmin
      .from("plaid_transactions")
      .select(
        "plaid_transaction_id, posted_date, amount_cents, currency, description, merchant_key, canonical_name, normalized_descriptor, pfc_primary, pfc_detailed, pending"
      )
      .eq("user_id", userId)
      .eq("pending", false)
      .not("merchant_key", "is", null)
      .order("posted_date", { ascending: true })
      .order("plaid_transaction_id", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      // Surface but don't blow up the scan — return what we have.
      // eslint-disable-next-line no-console
      console.error("[scan] readStoredTransactions page error", error);
      break;
    }

    const page = data ?? [];
    for (const r of page) {
      out.push({
        txn_id: r.plaid_transaction_id as string,
        date: r.posted_date as string,
        amount_dollars: ((r.amount_cents as number) ?? 0) / 100,
        currency: (r.currency as string) ?? "USD",
        raw_descriptor: (r.description as string) ?? "",
        merchant_key: r.merchant_key as string,
        canonical_name: (r.canonical_name as string) ?? "",
        normalized_descriptor: (r.normalized_descriptor as string) ?? "",
        pfc_primary: (r.pfc_primary as string | null) ?? null,
        pfc_detailed: (r.pfc_detailed as string | null) ?? null,
      });
    }

    if (page.length < PAGE) break;
    offset += PAGE;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Plaid recurring as SECONDARY enrichment.
//
// We still call /transactions/recurring/get because Plaid's status field
// (MATURE / EARLY_DETECTION / TOMBSTONED) and PFC tagging can refine
// the classifier verdict on borderline streams. But the engine does NOT
// trust Plaid for which streams exist — that's our job over stored
// transactions. Failure here is non-fatal.
// ---------------------------------------------------------------------------

type EnrichmentRecord = {
  status: string;
  pfc_primary: string | null;
  pfc_detailed: string | null;
};

async function fetchPlaidRecurringEnrichment(
  userId: string
): Promise<Map<string, EnrichmentRecord>> {
  const out = new Map<string, EnrichmentRecord>();
  if (!supabaseAdmin || !plaidClient) return out;
  const { data: items } = await supabaseAdmin
    .from("plaid_items")
    .select("id, plaid_access_token")
    .eq("user_id", userId)
    .eq("status", "active");

  for (const it of items ?? []) {
    try {
      const { decryptToken } = await import("./crypto");
      const res = await plaidClient.transactionsRecurringGet({
        access_token: decryptToken(it.plaid_access_token as string),
      });
      for (const s of res.data.outflow_streams ?? []) {
        const desc = s.description ?? s.merchant_name ?? "";
        const norm = normalizeDescriptor(desc);
        const key = (norm.catalog_key ?? norm.merchant_name).toLowerCase();
        out.set(key, {
          status: s.status ?? "",
          pfc_primary: s.personal_finance_category?.primary ?? null,
          pfc_detailed: s.personal_finance_category?.detailed ?? null,
        });
      }
    } catch (e) {
      // Enrichment is best-effort.
      observeError(e, {
        route: "scan.enrichment",
        tags: { itemId: it.id as string, userId },
      });
    }
  }
  return out;
}

// (firstNonNull placeholder removed — TxnInput now carries pfc_primary
// and pfc_detailed directly from plaid_transactions.)

// ---------------------------------------------------------------------------
// LLM tiebreak for the classifier (only invoked on Gate B score == 2).
// Temperature pinned to 0 for determinism.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Math helpers + concurrency cap.
// ---------------------------------------------------------------------------

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
    case "quarterly":
      return Math.round(amount_cents / 3);
    default:
      return 0;
  }
}

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

// ---------------------------------------------------------------------------
// finalizeScan.
//
// Lifecycle state machine (migration 008):
//   running → finalizing → done | error | timeout
// Snapshot writes happen at `finalizing`; cache invalidation + terminal
// status happen after. The client treats `done` as the safe-to-read
// signal.
// ---------------------------------------------------------------------------

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
    metrics: Record<string, unknown>;
  }
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
        status: "finalizing",
        metrics: snapshot.metrics,
      })
      .eq("id", scanId);

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
      scanner_version: SCANNER_VERSION,
    });
    if (snapErr) {
      // eslint-disable-next-line no-console
      console.error("[scan] snapshot insert failed", snapErr);
    }

    if (detected > 0 || failedItems === 0) {
      await supabaseAdmin
        .from("app_users")
        .update({ has_completed_scan: true })
        .eq("id", userId);
    }
  }

  try {
    revalidatePath("/app");
    revalidatePath("/app/scanning");
  } catch (e) {
    observeError(e, {
      route: "scan.finalize.revalidate",
      tags: { scanId, userId },
    });
  }

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

export type { ScanRow, ScanPhase };
