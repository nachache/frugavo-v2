import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cacheDel, redis } from "@/lib/cache";
import { normalizeDescriptor } from "@/lib/merchant-normalize";

// POST /api/dev/full-reset-and-load
//
// Resets the calling user's account to a true first-time state and
// optionally ingests a posted Plaid v2 transactions payload. Used
// for end-to-end onboarding / scan-quality testing.
//
// Auth — two paths:
//   1. Clerk session whose user id is in FRUGAVO_DEV_RESET_ALLOWED
//      (comma-separated list). Normal browser-driven use.
//   2. Authorization: Bearer <CRON_SECRET> header + clerk_user_id
//      in the body. Used for terminal-driven runs (curl) where no
//      Clerk cookie is available.
//
// Body (all optional unless using CRON_SECRET auth):
//   {
//     clerk_user_id?: string,      // REQUIRED with CRON_SECRET auth
//     transactions?: PlaidTransactionV2[],
//     institution_name?: string,   // defaults to "Test Institution"
//     wipe_only?: boolean          // skip the ingest path
//   }
//
// What gets wiped (per-user only — no global state):
//   plaid_transactions, plaid_items
//   subscriptions, subscription_charges
//   scan_snapshots, scan_runs (if present)
//   monitoring_alerts
//   billing_email_dispatches, email_dispatches
//   notification_preferences, user_overrides, feedback_events
//   stripe_customers (which cascades subscriptions_billing,
//   billing_entitlements, payment_methods_mirror via app code —
//   we delete each explicitly to avoid relying on FK cascades)
//   app_users.has_completed_scan / signup_notified_at / public_slug
//     are reset; the row itself stays so the Clerk id mapping
//     survives.
//
// Plus Redis caches keyed on user id.

export const runtime = "nodejs";
export const maxDuration = 60;

type PlaidV2Transaction = {
  transaction_id?: string;
  account_id?: string;
  amount?: number;
  iso_currency_code?: string | null;
  date?: string;
  authorized_date?: string | null;
  name?: string;
  merchant_name?: string | null;
  pending?: boolean;
  personal_finance_category?: { primary?: string; detailed?: string } | null;
  category?: string[] | null;
};

type Body = {
  clerk_user_id?: string;
  transactions?: PlaidV2Transaction[];
  institution_name?: string;
  wipe_only?: boolean;
};

function isAllowed(clerkUserId: string): boolean {
  const allow = (process.env.FRUGAVO_DEV_RESET_ALLOWED ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allow.includes(clerkUserId);
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = { wipe_only: true };
  }

  // Two auth paths. Try Bearer CRON_SECRET first since it's the
  // terminal-driven path; fall back to Clerk session otherwise.
  let userId: string | null = null;
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    if (!body.clerk_user_id || typeof body.clerk_user_id !== "string") {
      return NextResponse.json(
        {
          error: "missing_clerk_user_id",
          hint: "With CRON_SECRET auth, body.clerk_user_id is required.",
        },
        { status: 400 }
      );
    }
    if (!isAllowed(body.clerk_user_id)) {
      return NextResponse.json(
        { error: "Forbidden", hint: "User not in FRUGAVO_DEV_RESET_ALLOWED." },
        { status: 403 }
      );
    }
    userId = body.clerk_user_id;
  } else {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAllowed(user.id)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          hint: "Add this Clerk user id to FRUGAVO_DEV_RESET_ALLOWED env.",
        },
        { status: 403 }
      );
    }
    userId = user.id;
  }
  const summary: Record<string, number | string> = { user_id: userId };

  // ---- 1. Wipe per-user tables ----
  const tablesByUserId = [
    "subscription_charges",
    "subscriptions",
    "plaid_transactions",
    "plaid_items",
    "scan_snapshots",
    "monitoring_alerts",
    "billing_email_dispatches",
    "email_dispatches",
    "notification_preferences",
    "user_overrides",
    "feedback_events",
    "billing_entitlements",
    "subscriptions_billing",
    "payment_methods_mirror",
    "stripe_customers",
  ];
  for (const table of tablesByUserId) {
    const field =
      table === "stripe_customers" ||
      table === "billing_entitlements" ||
      table === "subscriptions_billing" ||
      table === "payment_methods_mirror"
        ? "clerk_user_id"
        : "user_id";
    const { error } = await supabaseAdmin.from(table).delete().eq(field, userId);
    summary[`wiped_${table}`] = error ? `error: ${error.message}` : "ok";
  }

  // billing_events keyed by stripe_customer_id, which was just
  // deleted — clean the orphans too. We can't filter by user_id
  // directly (no such column on billing_events).
  // Skip this — deleted rows in stripe_customers leave billing_events
  // referencing dead customer ids. Harmless for the test; reconciler
  // will eventually prune.

  // ---- 2. Reset flags on app_users (keep the row) ----
  const { error: appUserErr } = await supabaseAdmin
    .from("app_users")
    .update({
      has_completed_scan: false,
      has_active_subscription: false,
      signup_notified_at: null,
      public_slug: null,
    })
    .eq("id", userId);
  summary["app_users_reset"] = appUserErr ? `error: ${appUserErr.message}` : "ok";

  // ---- 3. Clear per-user Redis caches ----
  const cacheKeys = [
    `billing:ent:v1:peace_of_mind:${userId}`,
    `score:overrides:v1:${userId}`,
    `lock:scan:${userId}`,
    `rescan:cooldown:${userId}`,
    `rl:feedback:${userId}`,
    `lock:billing:create-customer:${userId}`,
  ];
  let cacheCleared = 0;
  for (const k of cacheKeys) {
    await cacheDel(k);
    cacheCleared++;
  }
  // Best-effort scan-event stream cleanup (we don't know scan ids
  // ahead of time but the stream key prefix is scan:*).
  if (redis) {
    try {
      // No SCAN abstraction in our cache module; scan-events keys
      // are short-lived (24h TTL by Redis) so we skip explicit
      // deletion. Re-running the scan creates new keys.
    } catch {
      // ignore
    }
  }
  summary["cache_keys_deleted"] = cacheCleared;

  if (body.wipe_only) {
    return NextResponse.json({ ok: true, wiped: true, ...summary });
  }

  // ---- 4. Ingest fresh plaid_items + plaid_transactions ----
  const transactions = Array.isArray(body.transactions)
    ? body.transactions
    : [];

  if (transactions.length === 0) {
    return NextResponse.json({
      ok: true,
      wiped: true,
      ingested: 0,
      note: "No transactions in payload — wipe completed but nothing loaded.",
      ...summary,
    });
  }

  // Create a synthetic plaid_items row so the scan engine has a
  // valid plaid_item_id FK to reference.
  const institutionName = body.institution_name ?? "Test Institution";
  const fakePlaidItemId = `dev_reset_${Date.now()}`;
  // last_synced_at intentionally null so the dashboard's
  // "first-scan" branch fires on the next /app visit and the user
  // gets the cinematic welcome reveal.
  const { data: itemRow, error: itemErr } = await supabaseAdmin
    .from("plaid_items")
    .insert({
      user_id: userId,
      plaid_item_id: fakePlaidItemId,
      plaid_access_token: "dev_reset_no_token",
      institution_name: institutionName,
      institution_id: "dev_reset",
      status: "active",
      last_synced_at: null,
    })
    .select("id")
    .single();

  if (itemErr || !itemRow) {
    return NextResponse.json(
      {
        ok: false,
        error: "plaid_items insert failed",
        detail: itemErr?.message,
        ...summary,
      },
      { status: 500 }
    );
  }

  const plaidItemDbId = itemRow.id as string;

  // Transform Plaid v2 transactions into our plaid_transactions row
  // shape. Mirrors the same enrichment lib/plaid-sync.ts:buildTxnRow
  // does at production-sync time so the detector sees the same
  // shape it sees for real users:
  //   - amount_cents NEGATIVE for outflows (Plaid is positive-outflow,
  //     we store negative-outflow internally)
  //   - merchant_key set via normalizeDescriptor + biller-passthrough
  //     amount-tier trick
  //   - canonical_name + normalized_descriptor populated
  //
  // The recurrence detector filters `merchant_key is not null` and
  // operates on negative cents — without these fields zero
  // subscriptions are detected.
  const rows = transactions
    .filter(
      (t) => t && t.transaction_id && t.date && typeof t.amount === "number"
    )
    .map((t) => {
      const desc = t.merchant_name ?? t.name ?? "";
      const norm = normalizeDescriptor(desc);
      const baseKey = (norm.catalog_key ?? norm.merchant_name).toLowerCase();
      const amountDollars = Math.abs(t.amount ?? 0);
      let merchantKey = baseKey;
      if (norm.biller_passthrough) {
        const tier =
          amountDollars < 50
            ? Math.floor(amountDollars / 5)
            : 10 + Math.floor(amountDollars / 20);
        merchantKey = `${baseKey}_t${tier}`;
      }
      const normalizedDescriptor = desc
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
      return {
        user_id: userId,
        plaid_item_id: plaidItemDbId,
        plaid_transaction_id: t.transaction_id!,
        plaid_stream_id: null,
        account_id: t.account_id ?? "unknown",
        // Negative = outflow (matches lib/plaid-sync.ts convention).
        amount_cents: Math.round((t.amount ?? 0) * 100 * -1),
        currency: t.iso_currency_code ?? "USD",
        iso_currency_code: t.iso_currency_code ?? null,
        unofficial_currency_code: null,
        merchant_name: t.merchant_name ?? null,
        name: t.name ?? null,
        description: desc,
        pfc_primary: t.personal_finance_category?.primary ?? null,
        pfc_detailed: t.personal_finance_category?.detailed ?? null,
        authorized_date: t.authorized_date ?? null,
        posted_date: t.date!,
        pending: t.pending ?? false,
        raw: t as unknown as Record<string, unknown>,
        normalized_descriptor: normalizedDescriptor,
        merchant_key: merchantKey,
        canonical_name: norm.merchant_name,
      };
    });

  // Insert in chunks to stay under PostgREST payload limits.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error: txErr, count } = await supabaseAdmin
      .from("plaid_transactions")
      .insert(slice, { count: "exact" });
    if (txErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "plaid_transactions insert failed",
          detail: txErr.message,
          inserted_so_far: inserted,
          ...summary,
        },
        { status: 500 }
      );
    }
    inserted += count ?? slice.length;
  }

  return NextResponse.json({
    ok: true,
    wiped: true,
    ingested: inserted,
    plaid_item_db_id: plaidItemDbId,
    institution_name: institutionName,
    next_step:
      "Visit /app — the dashboard will detect plaid_items + zero snapshots and auto-trigger a fresh scan, then redirect to /app/welcome.",
    ...summary,
  });
}
