import { supabaseAdmin } from "./supabase";
import {
  getPlaidItemDiagnostics,
  type PlaidDiagnosticSummary,
} from "./plaid-diagnostics";

// =========================================================================
// IngestionState — durable, state-aware readiness model.
//
// Replaces the earlier "derive at render time from scan_runs" pattern
// with a six-state machine that the UI reads from. Same shape Mercury,
// Brex, Ramp, Copilot use: the dashboard route is state-aware, not
// data-aware, so we never render numbers that contradict the ingestion
// reality.
//
// States:
//
//   preparing          Item exists, plaid sync hasn't returned anything
//                      yet. First few seconds after Plaid Link. No
//                      financial cards.
//
//   syncing            /transactions/sync is actively returning rows.
//                      We have partial data but the engine hasn't run
//                      yet OR a re-scan is in flight. No financial cards.
//
//   analyzing          Plaid sync drained. Engine is mid-pipeline
//                      (running/finalizing). No financial cards.
//
//   ready_with_results Scan finished, detected_count > 0. Full
//                      dashboard.
//
//   ready_but_empty    Scan finished, Plaid history confirmed complete,
//                      zero recurring charges detected. Honest empty
//                      dashboard (NOT the loading screen — this is the
//                      real "no subscriptions on this account" state).
//
//   needs_reauth       Plaid reports ITEM_LOGIN_REQUIRED on any item.
//                      Show re-link prompt; dashboard hidden.
//
// CRITICAL CONTRACT — the user-level cache:
//
//   Once app_users.first_ready_at is set, this module will NEVER return
//   preparing/syncing/analyzing again. Subsequent re-scans surface as
//   ready_with_results (with a separate "refreshing" badge driven by
//   in-flight scan_runs). The "never empty after first ready" rule.
//
//   needs_reauth always wins. If Plaid says re-link, we say re-link
//   even if first_ready_at is set — the cached data is stale and the
//   user needs to act.
// =========================================================================

export type IngestionState =
  | { state: "preparing"; diagnostics: PlaidDiagnosticSummary }
  | { state: "syncing"; diagnostics: PlaidDiagnosticSummary; txnCount: number }
  | {
      state: "analyzing";
      diagnostics: PlaidDiagnosticSummary;
      txnCount: number;
      scanStatus: "running" | "finalizing";
    }
  | {
      state: "ready_with_results";
      detectedCount: number;
      // True when there's a non-terminal scan_runs row in flight right
      // now — the UI can render a "refreshing" badge over the cached
      // dashboard without leaving the ready surface.
      refreshing: boolean;
      // ISO timestamp of the first time this user reached ready. Drives
      // the "never empty after first ready" cache rule.
      firstReadyAt: string;
    }
  | {
      state: "ready_but_empty";
      // Same as ready_with_results — engine finished, just no recurring
      // charges. The "honest empty" state.
      refreshing: boolean;
      firstReadyAt: string;
    }
  | {
      state: "needs_reauth";
      diagnostics: PlaidDiagnosticSummary;
    };

export async function computeIngestionState(
  userId: string
): Promise<IngestionState> {
  if (!supabaseAdmin) {
    // No DB → can't decide. Treat as preparing so we never render
    // financial cards in this state.
    return {
      state: "preparing",
      diagnostics: emptyDiagnostics(),
    };
  }

  // Pull everything we need in parallel. Three round-trips at worst.
  const [
    { data: itemsRaw },
    { data: latestScan },
    { data: userRow },
    diagnostics,
  ] = await Promise.all([
    supabaseAdmin
      .from("plaid_items")
      .select("id, sync_state, txn_count, completeness_score")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabaseAdmin
      .from("scan_runs")
      .select("id, status, detected_count, finished_at, metrics, started_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("app_users")
      .select("first_ready_at")
      .eq("id", userId)
      .maybeSingle(),
    getPlaidItemDiagnostics(userId),
  ]);

  // ──────────────────────────────────────────────────────────────
  // needs_reauth always wins. Live Plaid signal that the user must
  // act before any further sync is possible.
  // ──────────────────────────────────────────────────────────────
  if (diagnostics.anyNeedsReauth) {
    return { state: "needs_reauth", diagnostics };
  }

  // ──────────────────────────────────────────────────────────────
  // No items connected. This shouldn't normally hit computeIngestionState
  // because /app already redirects to /app/connect when items=0, but
  // defensively we surface preparing here too so callers always get a
  // valid state.
  // ──────────────────────────────────────────────────────────────
  const items = itemsRaw ?? [];
  if (items.length === 0) {
    return { state: "preparing", diagnostics };
  }

  const totalTxnCount = items.reduce(
    (sum, i) => sum + ((i.txn_count as number | null) ?? 0),
    0
  );
  const anyItemReady = items.some((i) => i.sync_state === "ready");
  const allItemsAwaitingBank = items.every(
    (i) => i.sync_state === "awaiting_bank" || i.sync_state === "pending"
  );

  // The cached-after-first-ready rule. Once we've ever shown a ready
  // dashboard for this user, we KEEP showing it. The most recent scan
  // may be in flight or have awaited bank data; the user still sees
  // their last-good snapshot, with a small "refreshing" indicator.
  const firstReadyAt = (userRow?.first_ready_at as string | null) ?? null;
  if (firstReadyAt) {
    const refreshing =
      latestScan?.status === "running" || latestScan?.status === "finalizing";
    // Determine whether this user's cached state is empty or has rows.
    // detectedCount on the latest TERMINAL scan is the source of truth
    // here — an in-flight scan doesn't yet know.
    const latestTerminal = await fetchLatestTerminalScan(userId);
    const detected = (latestTerminal?.detected_count as number | null) ?? 0;
    if (detected > 0) {
      return {
        state: "ready_with_results",
        detectedCount: detected,
        refreshing,
        firstReadyAt,
      };
    }
    // Cached "empty" — user genuinely has no subs OR their data was
    // recently purged. Either way, ready_but_empty is honest.
    return {
      state: "ready_but_empty",
      refreshing,
      firstReadyAt,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // First-time path. We've never been ready before.
  // ──────────────────────────────────────────────────────────────

  // If we have a terminal "done" scan with detected_count > 0, we are
  // ready RIGHT NOW. (first_ready_at will be backfilled by
  // finalizeScan or by this very render — see markFirstReadyIfNeeded
  // below.)
  if (latestScan && latestScan.status === "done") {
    const metrics = (latestScan.metrics ?? null) as
      | { awaiting_bank_data?: boolean }
      | null;
    const awaiting = Boolean(metrics?.awaiting_bank_data);
    const detected = (latestScan.detected_count as number | null) ?? 0;

    if (!awaiting && detected > 0) {
      // Backfill first_ready_at + send the completion email. Fire-and-
      // forget; the next render reads first_ready_at and takes the
      // cached path.
      void markFirstReadyIfNeeded(userId, "ready_with_results");
      return {
        state: "ready_with_results",
        detectedCount: detected,
        refreshing: false,
        firstReadyAt: (latestScan.finished_at as string) ?? new Date().toISOString(),
      };
    }

    if (!awaiting && detected === 0 && anyItemReady) {
      // Plaid delivered data, engine ran, nothing recurring found.
      // Honest empty state, not a loading state.
      void markFirstReadyIfNeeded(userId, "ready_but_empty");
      return {
        state: "ready_but_empty",
        refreshing: false,
        firstReadyAt: (latestScan.finished_at as string) ?? new Date().toISOString(),
      };
    }

    // status='done' but awaiting_bank_data=true OR no item is ready.
    // Bank hasn't delivered transactions. Fall through to preparing /
    // syncing / analyzing decision below.
  }

  // Non-terminal scan in flight.
  if (
    latestScan?.status === "running" ||
    latestScan?.status === "finalizing"
  ) {
    return {
      state: "analyzing",
      diagnostics,
      txnCount: totalTxnCount,
      scanStatus: latestScan.status as "running" | "finalizing",
    };
  }

  // No in-flight scan. Decide between preparing and syncing based on
  // what plaid_items knows. If any item has actually pulled rows
  // (txn_count > 0 OR sync_state='syncing'), we're past preparing.
  if (totalTxnCount > 0 || items.some((i) => i.sync_state === "syncing")) {
    return {
      state: "syncing",
      diagnostics,
      txnCount: totalTxnCount,
    };
  }

  // Everything else: still preparing. This is the "Plaid Classic queue"
  // case too — items exist, sync called, zero rows back, awaiting_bank.
  void allItemsAwaitingBank; // captured for future telemetry
  return {
    state: "preparing",
    diagnostics,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Writers — called by finalizeScan, the webhook handler, and the sync
// worker to keep the durable state up to date.
// ──────────────────────────────────────────────────────────────────────

export async function writeItemSyncState(args: {
  plaidItemRowId: string;
  syncState:
    | "pending"
    | "syncing"
    | "awaiting_bank"
    | "ready"
    | "needs_reauth"
    | "error";
  txnCountDelta?: number;
  oldestTxnDate?: string | null;
  newestTxnDate?: string | null;
  errorCode?: string | null;
  webhookCode?: string | null;
}): Promise<void> {
  if (!supabaseAdmin) return;
  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    sync_state: args.syncState,
    updated_at: nowIso,
  };
  if (args.syncState === "ready" || args.syncState === "syncing") {
    update.last_synced_at = nowIso;
  }
  if (args.oldestTxnDate) update.oldest_txn_date = args.oldestTxnDate;
  if (args.newestTxnDate) update.newest_txn_date = args.newestTxnDate;
  if (args.errorCode) {
    update.last_error_code = args.errorCode;
    update.last_error_at = nowIso;
  }
  if (args.webhookCode) {
    update.last_webhook_code = args.webhookCode;
    update.last_webhook_at = nowIso;
  }
  if (typeof args.txnCountDelta === "number" && args.txnCountDelta !== 0) {
    // Read-modify-write. Race-tolerant because txn_count is a hint
    // (the dashboard never gates on its exact value), not an
    // invariant.
    const { data: cur } = await supabaseAdmin
      .from("plaid_items")
      .select("txn_count, first_synced_at")
      .eq("id", args.plaidItemRowId)
      .maybeSingle();
    update.txn_count =
      ((cur?.txn_count as number | null) ?? 0) + args.txnCountDelta;
    // Set first_synced_at exactly once — the moment we first see a
    // non-zero delta. Subsequent deltas only bump txn_count.
    if (!cur?.first_synced_at) update.first_synced_at = nowIso;
  }
  await supabaseAdmin
    .from("plaid_items")
    .update(update)
    .eq("id", args.plaidItemRowId);
}

// Mark first_ready_at on the user row. Idempotent — only writes when
// first_ready_at is currently null. Also triggers the completion
// email path.
export async function markFirstReadyIfNeeded(
  userId: string,
  reachedState: "ready_with_results" | "ready_but_empty"
): Promise<void> {
  if (!supabaseAdmin) return;
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("first_ready_at, first_ready_email_sent_at, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.first_ready_at) return;

  await supabaseAdmin
    .from("app_users")
    .update({ first_ready_at: new Date().toISOString() })
    .eq("id", userId)
    .is("first_ready_at", null);

  // eslint-disable-next-line no-console
  console.log(
    "[first-ready] triggered",
    JSON.stringify({
      userId,
      email: data.email,
      reachedState,
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
    })
  );

  // Email completion. Fire-and-forget — if the send fails,
  // first_ready_email_sent_at stays null and the next scan retries.
  void sendFirstReadyEmail({
    userId,
    email: (data.email as string | null) ?? null,
    reachedState,
  });
}

async function sendFirstReadyEmail(args: {
  userId: string;
  email: string | null;
  reachedState: "ready_with_results" | "ready_but_empty";
}): Promise<void> {
  if (!supabaseAdmin) {
    // eslint-disable-next-line no-console
    console.warn("[first-ready-email] skipped: no supabaseAdmin");
    return;
  }
  if (!args.email) {
    // eslint-disable-next-line no-console
    console.warn("[first-ready-email] skipped: no email on app_users for", args.userId);
    return;
  }
  try {
    // ─── Build the insight payload ──────────────────────────────
    // The email leads with quantified observations ("4 services
    // totaling $164/mo"), not a status line. We pull from the
    // canonical dashboard selector so the email never disagrees
    // with what the user sees on /app.
    const { buildDashboardData } = await import("./selectors/dashboard");
    const dash = await buildDashboardData(args.userId).catch(() => null);
    const insights = {
      subCount: dash?.monthly.sub_only_count ?? 0,
      monthlyTotalCents: dash?.monthly.sub_only_cents ?? 0,
      insightLine: dash?.concentration?.headline
        ? // Use the headline + detail as a single observational line.
          // Headline reads "Telecom dominates your recurring spend";
          // detail adds the specific %. Combine when both present.
          dash.concentration.detail
          ? `${dash.concentration.headline} — ${dash.concentration.detail}`
          : dash.concentration.headline
        : null,
    };

    // ─── Decide whether to absorb the trial_started email ───────
    // If the user activated their trial BEFORE first-ready fires,
    // the standalone "You're protected" email was deferred. We
    // detect that by checking the user's entitlement state. If
    // they're trialing/active and the trial_started dispatch row
    // doesn't exist yet, we absorb the protection acknowledgment
    // into THIS email and write a synthetic dispatch row so the
    // standalone never fires later.
    let includeProtectionLine = false;
    let trialStartedDedupKey: string | null = null;
    try {
      const { getEntitlement } = await import("./billing/entitlements");
      const { isEffectivelyPaid, isBetaAccess } = await import("./billing/beta");
      const ent = await getEntitlement(args.userId);
      // Beta users get the protection acknowledgment line too —
      // monitoring really is active for them. We just skip the
      // synthetic billing_email_dispatches write since there's no
      // real stripe subscription to dedup against.
      const isPaid = isEffectivelyPaid(ent);
      const isBeta = isBetaAccess(ent);
      if (isPaid) {
        const dedupKey = ent.stripe_subscription_id ?? `merged-${args.userId}`;
        // Only set the dedup key when there's a real subscription
        // we could double-dispatch against. Beta has no subscription.
        if (!isBeta) trialStartedDedupKey = dedupKey;
        // Has the trial_started email already been dispatched? If
        // not, this email absorbs it.
        const { data: priorDispatch } = await supabaseAdmin
          .from("billing_email_dispatches")
          .select("id")
          .eq("clerk_user_id", args.userId)
          .eq("email_type", "trial_started")
          .eq("dedup_key", dedupKey)
          .maybeSingle();
        if (!priorDispatch) includeProtectionLine = true;
      }
    } catch (e) {
      // Non-fatal — if entitlement lookup fails, we just send the
      // standard first-ready email without the protection line.
      // eslint-disable-next-line no-console
      console.warn("[first-ready-email] entitlement lookup failed", e);
    }

    // Lazy import so the dashboard render path doesn't pull in the
    // mailer's dependencies until it actually has to send.
    const { sendFirstReadyEmail: send } = await import("./email/first-ready");
    const result = await send({
      email: args.email,
      reachedState: args.reachedState,
      insights,
      includeProtectionLine,
    });
    // eslint-disable-next-line no-console
    console.log(
      "[first-ready-email] send result",
      JSON.stringify({
        email: args.email,
        result,
        includeProtectionLine,
      })
    );
    await supabaseAdmin
      .from("app_users")
      .update({ first_ready_email_sent_at: new Date().toISOString() })
      .eq("id", args.userId);

    // If we absorbed the trial_started email, register a synthetic
    // dispatch row so future webhook replays of customer.subscription
    // .created / .updated won't try to send it again.
    if (includeProtectionLine && trialStartedDedupKey) {
      try {
        await supabaseAdmin
          .from("billing_email_dispatches")
          .insert({
            clerk_user_id: args.userId,
            email_type: "trial_started",
            dedup_key: trialStartedDedupKey,
            status: "merged_into_first_ready",
          });
      } catch (e) {
        // Best-effort. If the dispatch table conflicts (unique
        // violation because a row already exists) we silently move
        // on — the user won't get a double-send either way.
        // eslint-disable-next-line no-console
        console.info(
          "[first-ready-email] merge dispatch insert (non-fatal)",
          e instanceof Error ? e.message : String(e)
        );
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      "[first-ready-email] FAILED",
      JSON.stringify({
        email: args.email,
        userId: args.userId,
        error: e instanceof Error ? e.message : String(e),
      })
    );
  }
}

async function fetchLatestTerminalScan(
  userId: string
): Promise<{ detected_count: number | null; finished_at: string | null } | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("scan_runs")
    .select("detected_count, finished_at")
    .eq("user_id", userId)
    .in("status", ["done", "error", "timeout"])
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? {
        detected_count: (data.detected_count as number | null) ?? 0,
        finished_at: (data.finished_at as string | null) ?? null,
      }
    : null;
}

function emptyDiagnostics(): PlaidDiagnosticSummary {
  return {
    items: [],
    anyNeedsReauth: false,
    noSuccessfulUpdateYet: true,
    bankNames: "",
  };
}
