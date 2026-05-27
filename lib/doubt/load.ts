import { supabaseAdmin } from "../supabase";

// =========================================================================
// Doubt loader — server-side fetch for the Quick Checks dashboard
// module + the inline scan-reveal chips (Phase D).
//
// Returns the top N open doubts for a user, joined with subscription
// display info (merchant name, amount, frequency, last charged date)
// so the UI can render without a second query per row.
//
// Ranking (highest priority first):
//   1. Highest monthly equivalent (most material first)
//   2. Lowest confidence (least sure first within material tier)
//   3. Newest first (most recent detections take precedence)
//
// "Open" = resolved_at IS NULL AND silenced_at IS NULL. Auto-promoted
// items stay in the list until the user explicitly resolves them.
// =========================================================================

export type OpenDoubt = {
  id: string;
  subscription_id: string;
  merchant_key: string;
  prompt_kind: string;
  confidence: number;
  created_at: string;
  auto_promoted_at: string | null;
  ignored_count: number;
  // Display fields joined from subscriptions for one-shot rendering.
  display: {
    merchant_name: string;
    amount_cents: number;
    currency: string;
    frequency: string;
    last_charged_at: string | null;
    category: string | null;
  };
};

const DEFAULT_LIMIT = 5;

export async function loadOpenDoubts(
  userId: string,
  opts: { limit?: number; surface?: "dashboard_module" | "scan_chip" } = {}
): Promise<OpenDoubt[]> {
  if (!supabaseAdmin) return [];
  const limit = opts.limit ?? DEFAULT_LIMIT;

  // Single round-trip with embedded join. Filter by open lifecycle
  // (no resolved_at, no silenced_at). For the dashboard module we
  // additionally filter to items in the dashboard-prompt confidence
  // zone (≥ 0.55) — items below that threshold are scan-chip
  // territory and live in a separate surface. Auto-promoted items
  // always show in the dashboard module regardless of their original
  // confidence bucket so possible waste is never invisible forever.
  let query = supabaseAdmin
    .from("doubt_items")
    .select(
      `
      id,
      subscription_id,
      merchant_key,
      prompt_kind,
      confidence,
      created_at,
      auto_promoted_at,
      ignored_count,
      subscription:subscriptions!inner(
        merchant_name,
        amount_cents,
        currency,
        frequency,
        last_charged_at,
        category
      )
    `
    )
    .eq("user_id", userId)
    .is("resolved_at", null)
    .is("silenced_at", null);

  if (opts.surface === "dashboard_module") {
    // Dashboard module shows confidence ≥ 0.55 OR anything auto-promoted.
    // The auto-promoted branch surfaces items that started life as
    // scan-chip but the user never answered — after 7 days they
    // become Worth a look candidates with a low-confidence badge.
    query = query.or(`confidence.gte.0.55,auto_promoted_at.not.is.null`);
  } else if (opts.surface === "scan_chip") {
    // Scan-chip surface only — strict lower bound.
    query = query.lt("confidence", 0.55).is("auto_promoted_at", null);
  }

  // Ranking: subscription amount desc, then confidence asc, then
  // recency. PostgREST can't ORDER BY a joined column directly, so
  // we sort in-memory after fetching a slightly wider window.
  const fetchN = Math.max(limit * 3, 15);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(fetchN);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[doubt-load] query failed", error);
    return [];
  }

  // PostgREST embeds joins as ARRAYS regardless of cardinality, so
  // `subscription` comes back as a 0/1-element array (the !inner above
  // guarantees at most one). Normalize to a single object below.
  type RawSub = {
    merchant_name: string;
    amount_cents: number;
    currency: string;
    frequency: string;
    last_charged_at: string | null;
    category: string | null;
  };
  type RawRow = {
    id: string;
    subscription_id: string;
    merchant_key: string;
    prompt_kind: string;
    confidence: number;
    created_at: string;
    auto_promoted_at: string | null;
    ignored_count: number;
    subscription: RawSub[] | RawSub | null;
  };

  const rawRows = (data ?? []) as unknown as RawRow[];

  type FlatRow = Omit<RawRow, "subscription"> & { subscription: RawSub };
  const withSub: FlatRow[] = rawRows
    .map((r) => {
      const sub = Array.isArray(r.subscription)
        ? r.subscription[0] ?? null
        : r.subscription;
      if (!sub) return null;
      return { ...r, subscription: sub } as FlatRow;
    })
    .filter((r): r is FlatRow => r !== null);

  // Final ranking — amount desc, confidence asc, created_at desc.
  withSub.sort((a, b) => {
    const amtDiff =
      Math.abs(b.subscription.amount_cents) -
      Math.abs(a.subscription.amount_cents);
    if (amtDiff !== 0) return amtDiff;
    const confDiff = a.confidence - b.confidence;
    if (confDiff !== 0) return confDiff;
    return b.created_at.localeCompare(a.created_at);
  });

  return withSub.slice(0, limit).map((r) => ({
    id: r.id,
    subscription_id: r.subscription_id,
    merchant_key: r.merchant_key,
    prompt_kind: r.prompt_kind,
    confidence: r.confidence,
    created_at: r.created_at,
    auto_promoted_at: r.auto_promoted_at,
    ignored_count: r.ignored_count,
    display: {
      merchant_name: r.subscription.merchant_name,
      amount_cents: r.subscription.amount_cents,
      currency: r.subscription.currency,
      frequency: r.subscription.frequency,
      last_charged_at: r.subscription.last_charged_at,
      category: r.subscription.category,
    },
  }));
}

// 7-day auto-promote pass. Marks any open low-confidence doubt
// (confidence < 0.55, created > 7 days ago) as auto_promoted_at so it
// surfaces in the dashboard module + ActionCenter's worth-a-look with
// a low-confidence badge. Idempotent — re-running doesn't disturb
// already-promoted rows.
//
// Called from the /app render path (cheap server query) so we don't
// need a separate cron. The dashboard always reflects current state.
export async function autoPromoteStaleDoubts(userId: string): Promise<number> {
  if (!supabaseAdmin) return 0;

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: promoted, error } = await supabaseAdmin
    .from("doubt_items")
    .update({
      auto_promoted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .is("resolved_at", null)
    .is("silenced_at", null)
    .is("auto_promoted_at", null)
    .lt("confidence", 0.55)
    .lt("created_at", sevenDaysAgo)
    .select("id, confidence");

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[doubt-load] auto-promote update failed", error);
    return 0;
  }

  const rows = (promoted ?? []) as Array<{ id: string; confidence: number }>;
  if (rows.length > 0) {
    // Append 'auto_promoted' events to the telemetry log.
    await supabaseAdmin.from("doubt_prompts_log").insert(
      rows.map((r) => ({
        user_id: userId,
        doubt_item_id: r.id,
        event: "auto_promoted",
        surface: null,
        confidence_at_event: r.confidence,
      }))
    );
  }
  return rows.length;
}
