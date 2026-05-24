import { revalidatePath } from "next/cache";
import { plaidClient } from "./plaid";
import { supabaseAdmin } from "./supabase";
import { observeError } from "./observe";
import { normalizeMerchant } from "@/lib/ai/normalize";
import {
  publishScanEvent,
  cacheKey,
  tryAcquireLock,
  redis,
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
  classifyCacheKey,
  CLASSIFY_SYSTEM_PROMPT,
  CLASSIFY_LLM_VERSION,
  type ClassifyInput,
  type LlmClassifyResponse,
} from "./classify";
import { normalizeDescriptor } from "./merchant-normalize";
import type { SnapshotRow } from "./types/snapshot";
import { SCANNER_VERSION } from "./scanner-version";
import { subscriptionKey } from "./subscription-key";
import { syncAllItemsForUser } from "./plaid-sync";
import {
  scoreCandidate,
  featuresFromCharges,
  type CandidateFeatures as ScoringCandidateFeatures,
} from "./scoring";
import {
  getMerchantPrior,
  getMerchantDictionary,
} from "./merchants-store";
import { getOverridesForUser } from "./user-overrides";
import { assignTier } from "./tier-assignment";
import {
  resolveDescriptors,
  MERCHANT_RESOLVE_VERSION,
} from "./merchant-resolve";
import { pickModelForUser } from "./model-store";
import { runMonitoringForUser } from "./monitoring/run";
import {
  detectRecurringStreams,
  cadenceToFrequency,
  DEFAULT_PARAMS as DETECTOR_DEFAULT_PARAMS,
  type TxnInput,
  type DetectedStream,
  type GroupAudit,
  type DetectorParams,
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

export type ScanSource =
  | "plaid"
  | "webhook"
  | "manual"
  | "first_connect"
  | "cron";

export async function runScanForUser(
  userId: string,
  source: ScanSource = "first_connect"
): Promise<ScanResult> {
  const t0 = Date.now();
  // supabaseAdmin is required (we read + write tables). plaidClient
  // is only needed to PULL new transactions from Plaid; if absent,
  // we skip Step 1 (sync) and re-classify whatever's already in
  // plaid_transactions. This lets verify:scan:live / replay / CI
  // run without Plaid credentials.
  if (!supabaseAdmin) {
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
  // Skipped when plaidClient is absent (verify / replay / CI paths).
  // The pipeline still runs against the transactions already in DB.
  let syncMetrics = { items: 0, added: 0, modified: 0, removed: 0, pages: 0 };
  if (!plaidClient) {
    // eslint-disable-next-line no-console
    console.warn("[scan] plaidClient unavailable — skipping sync, will re-classify existing transactions");
  } else try {
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
  const { txns, raw: storedRows } = await readStoredTransactions(userId);

  // ---- Step 2.5: canonical merchant identity resolution ----
  // THE RECALL FIX. We call Claude in batch on every distinct
  // descriptor that doesn't yet have a canonical_merchant_key set
  // in plaid_transactions, then UPDATE the table with the result.
  // The next time readStoredTransactions runs (e.g. on the next
  // scan), those rows already have a canonical key so the resolver
  // is a no-op for them — that's how the second scan stays at 0
  // resolution calls.
  //
  // We mutate the in-memory txns array AFTER the UPDATE lands so the
  // detector groups by canonical key on this very scan, not next one.
  const resolveMetrics = await resolveAndPersistCanonicalKeys({
    userId,
    storedRows,
    txns,
  });

  // ---- Step 3: optional Plaid /transactions/recurring/get enrichment ----
  // Fetched once per item. Only used for PFC + status hints on
  // matching merchant_keys. NEVER drives stream membership.
  const enrichment = await fetchPlaidRecurringEnrichment(userId);

  // ---- Step 4: deterministic detection ----
  const { streams: detected, audits } = detectRecurringStreams(txns);
  void resolveMetrics; // surfaced via debug logging below + scan metrics

  // ---- Step 4.5: identity-strong survival ----
  // Re-promote rejected groups that have identity (catalog hit OR
  // resolved with merchant_domain) but fell just below the band
  // minimum. The classifier still has the final word — they enter as
  // candidates and need to clear classification to become confirmed
  // subscriptions. This is a generalized identity rule, not a per-
  // merchant exception.
  const rescued = identityStrongSurvival({
    txns,
    audits,
    detected,
  });
  for (const r of rescued) {
    detected.push(r);
  }

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
  // Set of subscription_keys touched in this scan. Used at the end of
  // the loop to tombstone any active subscription whose key wasn't
  // re-detected.
  const activeSubKeys = new Set<string>();

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
    // Track the subscription_key we just wrote so we can tombstone
    // anything NOT in this set below.
    activeSubKeys.add(result.scanRow.stream_id);
  });

  // ---- Orphan tombstone ----
  // Any subscription on this user that is still status='active' but
  // whose subscription_key isn't in the current scan's accepted set
  // has stopped being detected. Could be: user cancelled, Plaid
  // stopped reporting it, classifier got tighter and the descriptor
  // now hits Gate A. Either way, the dashboard shouldn't keep
  // showing it as live spend.
  //
  // Generalized rule — no merchant-specific logic. The engine treats
  // "not in latest scan" as the same signal regardless of brand.
  // We mark status='cancelled' (not delete) so the user's prior
  // decisions and history stay intact, and so a future re-detect can
  // re-activate the row deterministically via the same subscription_key.
  if (supabaseAdmin) {
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id, subscription_key")
      .eq("user_id", userId)
      .eq("status", "active");
    if (!existingErr && existing) {
      const orphanIds = existing
        .filter(
          (r) =>
            r.subscription_key &&
            !activeSubKeys.has(r.subscription_key as string)
        )
        .map((r) => r.id as string);
      if (orphanIds.length > 0) {
        const { error: tombErr } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "cancelled",
            updated_at: asOfIso,
          })
          .in("id", orphanIds);
        if (tombErr) {
          // eslint-disable-next-line no-console
          console.error("[scan] orphan tombstone failed", tombErr);
        } else if (process.env.FRUGAVO_SCAN_DEBUG_USER_ID === userId) {
          // eslint-disable-next-line no-console
          console.log(
            `[scan:debug] tombstoned ${orphanIds.length} orphan subscriptions (not in scan ${scanId})`
          );
        }
      }
    }
  }

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

  // Peace of Mind monitoring — run detectors against the freshly-
  // written snapshot. Non-fatal: alert failures must not break the
  // scan itself.
  try {
    const monitoring = await runMonitoringForUser({ userId, scanRunId: scanId });
    if (process.env.FRUGAVO_SCAN_DEBUG_USER_ID === userId) {
      // eslint-disable-next-line no-console
      console.log(`[monitoring] alerts_written=${monitoring.alerts_written}`);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[monitoring] runMonitoringForUser failed", e);
  }

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
    // v2 classifier brain inputs — drive the cache key and feed the
    // Claude prompt with the canonical identity from the resolver.
    canonicalMerchantKey: stream.merchant_key, // already canonical after Stage 2.5
    cadenceBand: stream.frequency,
  };

  const verdict = await classifyStream(classifyInput, cachedClassify);
  if (verdict.decision === "reject") return null;
  if (!verdict.classification) return null;

  // ---- Shadow scoring (Track A — dual-write) ----
  //
  // The probabilistic scoring system runs ALONGSIDE the existing
  // Gate A/B classifier. The result is recorded in classification_
  // signals as tagged strings (score:0.78, scored_decision:subscription,
  // prior:a50b1) so we can compare the two paths offline and gradually
  // swap the engine without a flag day. The Gate A/B verdict still
  // drives the row's `classification` column for now.
  //
  // Failure here is non-fatal — the existing pipeline keeps working
  // if the scoring layer ever errors.
  const shadowSignals: string[] = [];
  // Hoisted out so the upsert below can read the tier assignment.
  // Sensible defaults if scoring fails: we trust the classifier's
  // verdict and let the merchant-category prior alone pick the tier.
  let tierType:
    | "confirmed_subscription"
    | "recurring_bill"
    | "recurring_commerce"
    | "uncertain_recurring" = "uncertain_recurring";
  let tierConfidence = 50;
  try {
    const featureStats = featuresFromCharges(
      stream.transactions.map((t) => ({
        posted_date: t.date,
        amount_cents: Math.round(Math.abs(t.amount_dollars) * 100),
      }))
    );
    const [prior, dictionary, overrides, model] = await Promise.all([
      getMerchantPrior(stream.merchant_key),
      getMerchantDictionary(),
      getOverridesForUser(userId),
      pickModelForUser(userId),
    ]);
    const features: ScoringCandidateFeatures = {
      merchant_key: stream.merchant_key,
      regularity: featureStats.regularity,
      amount_consistency: featureStats.amount_consistency,
      occurrences: featureStats.occurrences,
      category,
      in_dictionary: dictionary.has(stream.merchant_key),
    };
    const override = overrides.get(stream.merchant_key);
    const scored = scoreCandidate({
      features,
      prior: prior ?? undefined,
      override: override ?? undefined,
      coeffs: model.coefficients,
    });
    shadowSignals.push(
      `score:${scored.probability.toFixed(3)}`,
      `scored_decision:${scored.decision}`,
      `scored_source:${scored.source}`,
      `model:${model.version_string ?? "default"}`,
      `bucket:${model.bucket}`,
      `prior:a${scored.prior_alpha.toFixed(1)}b${scored.prior_beta.toFixed(1)}`,
      `lo_prior:${scored.prior_log_odds.toFixed(2)}`,
      `lo_pattern:${scored.pattern_log_odds.toFixed(2)}`
    );
    if (scored.override_type) {
      shadowSignals.push(`override:${scored.override_type}`);
    }

    // ---- Tier assignment ----
    // Combines: classifier verdict + Beta/pattern log-odds +
    // merchant-category prior (PFC). Writes recurring_type and
    // confidence_score on the row so every downstream surface
    // (dashboard, reveal, personality, share card, money-leaks,
    // protection insights) reads from a single tagged column.
    const tier = assignTier({
      classification: verdict.classification,
      pfc_primary: pfcPrimary,
      pfc_detailed: pfcDetailed,
      combined_log_odds: scored.combined_log_odds,
      // Dictionary membership lets known subs (Apple, Amazon Prime,
      // Adobe, etc.) resist demotion to commerce when Plaid's PFC
      // is ambiguous (GENERAL_MERCHANDISE etc.).
      in_dictionary: features.in_dictionary,
      user_override: override?.override_type ?? null,
    });
    tierType = tier.recurring_type;
    tierConfidence = tier.confidence_score;
    shadowSignals.push(
      `tier:${tier.recurring_type}`,
      `conf:${tier.confidence_score}`,
      `tier_reason:${tier.reason}`
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[scan] shadow scoring failed", e);
  }

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
        classification_signals: [
          ...(verdict.signals ?? []),
          ...shadowSignals,
        ],
        classification_score: verdict.score,
        recurring_type: tierType,
        confidence_score: tierConfidence,
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

async function readStoredTransactions(
  userId: string
): Promise<{ txns: TxnInput[]; raw: StoredTxnRow[] }> {
  if (!supabaseAdmin) return { txns: [], raw: [] };

  // Supabase PostgREST caps single requests at 1000 rows by default
  // (db.max-rows). A user with >1000 outflows would silently lose the
  // tail of their history, which is exactly the long-running annual
  // and quarterly subscriptions the engine needs.
  //
  // Page through with .range() until we get a short page.
  const PAGE = 1000;
  const txns: TxnInput[] = [];
  const raw: StoredTxnRow[] = [];
  let offset = 0;

  // Hard ceiling so a runaway loop can't lock the function — 100k txns
  // is well beyond any sane personal-banking history window.
  const HARD_CEILING = 100_000;

  while (offset < HARD_CEILING) {
    const { data, error } = await supabaseAdmin
      .from("plaid_transactions")
      .select(
        "plaid_transaction_id, posted_date, amount_cents, currency, description, merchant_key, canonical_name, normalized_descriptor, pfc_primary, pfc_detailed, pending, canonical_merchant_key, canonical_display_name, canonical_domain"
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
      // Detector grouping key: prefer the resolved canonical key when
      // present, fall back to the legacy merchant_key. This is the
      // single point where the resolver result wins over normalizeDescriptor.
      const groupingKey =
        (r.canonical_merchant_key as string | null) ??
        (r.merchant_key as string);
      txns.push({
        txn_id: r.plaid_transaction_id as string,
        date: r.posted_date as string,
        amount_dollars: ((r.amount_cents as number) ?? 0) / 100,
        currency: (r.currency as string) ?? "USD",
        raw_descriptor: (r.description as string) ?? "",
        merchant_key: groupingKey,
        canonical_name:
          (r.canonical_display_name as string | null) ??
          (r.canonical_name as string) ??
          "",
        normalized_descriptor: (r.normalized_descriptor as string) ?? "",
        pfc_primary: (r.pfc_primary as string | null) ?? null,
        pfc_detailed: (r.pfc_detailed as string | null) ?? null,
      });
      raw.push({
        plaid_transaction_id: r.plaid_transaction_id as string,
        description: (r.description as string) ?? "",
        merchant_key: r.merchant_key as string,
        canonical_merchant_key: (r.canonical_merchant_key as string | null) ?? null,
      });
    }

    if (page.length < PAGE) break;
    offset += PAGE;
  }

  return { txns, raw };
}

// Row shape we carry alongside the TxnInput so the resolver step can
// see which rows are still missing a canonical key.
type StoredTxnRow = {
  plaid_transaction_id: string;
  description: string;
  merchant_key: string;
  canonical_merchant_key: string | null;
};

// ---------------------------------------------------------------------
// Identity-strong survival at Stage 2 minimums.
//
// Rationale: a merchant with a strong identity signal (in our catalog
// OR resolved with a merchant_domain) should still surface as a
// candidate even if it falls one charge short of the band minimum.
// The classifier still has the final word — these come in as
// candidates that have to clear classification, NOT as auto-confirmed
// subscriptions.
//
// Implementation: re-run the detector with min_occurrences-1 (down to
// floor of 2), then keep only the new streams that (a) weren't
// already in `detected` and (b) have identity per normalizeDescriptor.
// ---------------------------------------------------------------------
function identityStrongSurvival(args: {
  txns: TxnInput[];
  audits: GroupAudit[];
  detected: DetectedStream[];
}): DetectedStream[] {
  const { txns, detected } = args;

  // Relaxed params: one fewer occurrence required per band, floored at 2.
  const relaxedParams: DetectorParams = {
    ...DETECTOR_DEFAULT_PARAMS,
    min_occurrences_by_band: {
      default: Math.max(2, DETECTOR_DEFAULT_PARAMS.min_occurrences_by_band.default - 1),
      WEEKLY: Math.max(2, DETECTOR_DEFAULT_PARAMS.min_occurrences_by_band.WEEKLY - 1),
      BIWEEKLY: Math.max(2, DETECTOR_DEFAULT_PARAMS.min_occurrences_by_band.BIWEEKLY - 1),
      SEMI_MONTHLY: Math.max(2, DETECTOR_DEFAULT_PARAMS.min_occurrences_by_band.SEMI_MONTHLY - 1),
      MONTHLY: Math.max(2, DETECTOR_DEFAULT_PARAMS.min_occurrences_by_band.MONTHLY - 1),
      QUARTERLY: Math.max(2, DETECTOR_DEFAULT_PARAMS.min_occurrences_by_band.QUARTERLY - 1),
      ANNUALLY: Math.max(2, DETECTOR_DEFAULT_PARAMS.min_occurrences_by_band.ANNUALLY - 1),
    },
  };
  const { streams: relaxed } = detectRecurringStreams(txns, relaxedParams);

  // Skip anything already in detected.
  const seen = new Set(detected.map((s) => s.merchant_key));

  // Identity check: catalog hit OR a domain we know about. We re-use
  // normalizeDescriptor on each candidate's representative descriptor
  // because the catalog returns both catalog_key and domain.
  const out: DetectedStream[] = [];
  for (const s of relaxed) {
    if (seen.has(s.merchant_key)) continue;
    const hit = normalizeDescriptor(s.representative_descriptor);
    const hasIdentity = hit.catalog_key !== null || hit.domain !== null;
    if (!hasIdentity) continue;
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------
// Canonical merchant identity resolution.
//
// Find every distinct descriptor in this user's ledger that does NOT
// yet have a canonical_merchant_key set. Resolve in batch via Claude
// (with aggressive Redis caching), UPDATE plaid_transactions, and
// then mutate the in-memory txns array so the detector groups on the
// new canonical key during THIS scan.
//
// Returns simple metrics for instrumentation:
//   distinct: number of distinct unresolved descriptors we tried
//   resolved: number actually resolved (cache + LLM combined)
//   cache_hit_pct: % of distinct that resolved from cache (no LLM)
// ---------------------------------------------------------------------
async function resolveAndPersistCanonicalKeys(args: {
  userId: string;
  storedRows: StoredTxnRow[];
  txns: TxnInput[];
}): Promise<{
  distinct: number;
  resolved: number;
  cache_hit_pct: number;
}> {
  const { userId, storedRows, txns } = args;
  if (!supabaseAdmin) {
    return { distinct: 0, resolved: 0, cache_hit_pct: 0 };
  }

  // Only resolve rows we haven't resolved before. The canonical key
  // column is durable; once set we trust it across scans until the
  // resolver version bumps (a future enhancement could re-resolve
  // rows whose canonical_resolver_version is stale).
  const unresolved = storedRows.filter((r) => !r.canonical_merchant_key);
  if (unresolved.length === 0) {
    return { distinct: 0, resolved: 0, cache_hit_pct: 100 };
  }

  // Dedupe descriptors before calling the resolver. Different
  // plaid_transaction_ids can share a descriptor; the resolver only
  // needs one call per distinct descriptor.
  const distinctDescriptors = Array.from(
    new Set(unresolved.map((r) => r.description).filter(Boolean))
  );
  if (distinctDescriptors.length === 0) {
    return { distinct: 0, resolved: 0, cache_hit_pct: 100 };
  }

  // The resolver returns a Map<descriptor, ResolvedIdentity>. Anything
  // missing means resolution failed (cache miss + LLM error/timeout);
  // those rows keep their legacy merchant_key, no harm done.
  const identities = await resolveDescriptors(distinctDescriptors);

  // Bulk UPDATE plaid_transactions for every distinct descriptor that
  // resolved. We batch by canonical_merchant_key value to minimize
  // round-trips: one UPDATE per (canonical_key, descriptor) pair.
  //
  // Supabase JS doesn't expose bulk UPDATE with WHERE-by-list cleanly,
  // so we loop per descriptor. With max ~100 distinct unresolved per
  // scan this is fine; for big initial scans it's still <1s.
  let writeOk = 0;
  for (const [descriptor, identity] of identities) {
    if (!identity || !identity.canonical_merchant_key) continue;
    const { error } = await supabaseAdmin
      .from("plaid_transactions")
      .update({
        canonical_merchant_key: identity.canonical_merchant_key,
        canonical_display_name: identity.display_name,
        canonical_domain: identity.merchant_domain,
        canonical_resolved_at: new Date().toISOString(),
        canonical_resolver_version: MERCHANT_RESOLVE_VERSION,
      })
      .eq("user_id", userId)
      .eq("description", descriptor)
      .is("canonical_merchant_key", null);
    if (!error) writeOk++;
  }

  // Mutate in-memory txns so THIS scan groups by canonical key. We
  // also propagate the display name so the subscription row ends up
  // with a nice name instead of "APPLE.COM/BILL 866-712-7753".
  for (const t of txns) {
    const id = identities.get(t.raw_descriptor);
    if (id && id.canonical_merchant_key) {
      t.merchant_key = id.canonical_merchant_key;
      if (id.display_name) {
        t.canonical_name = id.display_name;
      }
    }
  }

  // Cache-hit percentage approximation: distinct descriptors that
  // resolved without us making an LLM call = those present in Redis
  // when resolveDescriptors started. The resolver doesn't expose
  // per-call cache stats, so we infer: identities.size = total
  // resolved (cache + LLM); writeOk = how many we persisted to DB
  // (only the ones that resolved). For real cache-hit telemetry the
  // resolver could return metrics — for now we just report the
  // resolved %.
  const resolved = identities.size;
  const cacheHitPct =
    distinctDescriptors.length === 0
      ? 100
      : Math.round((resolved / distinctDescriptors.length) * 100);
  void writeOk;
  return {
    distinct: distinctDescriptors.length,
    resolved,
    cache_hit_pct: cacheHitPct,
  };
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
// Classifier brain — Claude on every Gate A survivor, cached by
// (canonical_merchant_key, cadence_band, amount_bucket).
//
// Cache contract: same merchant + cadence + dollar bucket → same
// verdict, no LLM call. Second scan of the same ledger hits 100%
// cache. Cross-user reuse is safe — the verdict doesn't depend on
// user-specific data, only on the merchant signature.
// ---------------------------------------------------------------------------

const classifierClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Runtime metrics so the verify:scan harness can prove cache-hit ratio.
let cachedClassifyHits = 0;
let cachedClassifyMisses = 0;
let cachedClassifyErrors = 0;

export function resetClassifyMetrics() {
  cachedClassifyHits = 0;
  cachedClassifyMisses = 0;
  cachedClassifyErrors = 0;
}
export function readClassifyMetrics() {
  return {
    hits: cachedClassifyHits,
    misses: cachedClassifyMisses,
    errors: cachedClassifyErrors,
    hit_pct:
      cachedClassifyHits + cachedClassifyMisses === 0
        ? 100
        : Math.round(
            (cachedClassifyHits / (cachedClassifyHits + cachedClassifyMisses)) *
              100
          ),
  };
}

async function cachedClassify(
  input: ClassifyInput
): Promise<LlmClassifyResponse | null> {
  if (!classifierClient) return null;

  // Cache lookup. Cache key only constructable when we have a
  // canonical_merchant_key; without it we still call Claude but skip
  // caching (rare — only happens if resolver couldn't identify the
  // merchant, in which case the verdict is likely uncertain anyway).
  const ck = classifyCacheKey(input);
  if (ck && redis) {
    try {
      const cached = await redis.get<LlmClassifyResponse>(ck);
      if (
        cached &&
        typeof cached.is_subscription === "boolean" &&
        typeof cached.confidence === "number"
      ) {
        cachedClassifyHits++;
        return cached;
      }
    } catch {
      // fall through to live call
    }
  }

  cachedClassifyMisses++;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("classify_timeout"), 4_000);
  try {
    const res = await classifierClient.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
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
      cachedClassifyErrors++;
      return null;
    }
    // Cache write — 365d TTL. The signature is stable; Netflix monthly
    // at $15.49 doesn't change verdict over a year.
    if (ck && redis) {
      try {
        await redis.set(ck, parsed, { ex: 60 * 60 * 24 * 365 });
      } catch {
        // non-fatal: next scan re-asks; verdict is deterministic
      }
    }
    return parsed;
  } catch {
    cachedClassifyErrors++;
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
    // Silently ignore when called outside a Next request context
    // (verify:scan:live, replay, cron). The "static generation
    // store missing" invariant is expected in those paths and
    // doesn't indicate a real failure.
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("static generation store")) {
      observeError(e, {
        route: "scan.finalize.revalidate",
        tags: { scanId, userId },
      });
    }
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
