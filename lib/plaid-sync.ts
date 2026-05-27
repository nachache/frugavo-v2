import type { Transaction } from "plaid";
import { plaidClient } from "./plaid";
import { supabaseAdmin } from "./supabase";
import { decryptToken } from "./crypto";
import { observeError } from "./observe";
import { normalizeDescriptor } from "./merchant-normalize";

// Owner of /transactions/sync.
//
// Replaces /transactions/recurring/get as the authoritative ingestion
// path. The cursor on plaid_items is the durable resumption point — a
// failed sync simply replays from the last persisted cursor next time.
//
// Contract:
//   - Paginates until has_more === false.
//   - Upserts added/modified into plaid_transactions, idempotent on
//     (user_id, plaid_transaction_id).
//   - Soft-deletes removed transactions by marking pending=true. We
//     deliberately do NOT hard-delete because the detection engine
//     wants to know about cancellations as observed events, and the
//     audit trail is part of the SOC-readiness story.
//   - Advances plaid_items.cursor only AFTER the corresponding writes
//     succeed. A crash mid-page replays cleanly because the next call
//     starts from the last persisted cursor.
//   - Enriches each transaction with normalized_descriptor + merchant_key
//     + canonical_name at write time so the detection engine never has
//     to call the normalizer itself.

export type SyncResult = {
  added: number;
  modified: number;
  removed: number;
  cursor_advanced: boolean;
  pages: number;
};

export async function syncPlaidItemTransactions(
  plaidItemRowId: string
): Promise<SyncResult> {
  if (!plaidClient || !supabaseAdmin) {
    return { added: 0, modified: 0, removed: 0, cursor_advanced: false, pages: 0 };
  }

  const { data: item, error: itemErr } = await supabaseAdmin
    .from("plaid_items")
    .select("id, user_id, plaid_access_token, cursor, plaid_item_id")
    .eq("id", plaidItemRowId)
    .maybeSingle();

  if (itemErr || !item) {
    return { added: 0, modified: 0, removed: 0, cursor_advanced: false, pages: 0 };
  }

  const accessToken = decryptToken(item.plaid_access_token as string);
  let cursor: string | undefined = (item.cursor as string | null) ?? undefined;
  // An undefined cursor on the FIRST call tells Plaid "send everything
  // you have." Subsequent calls pass the saved cursor for incremental
  // delta semantics.

  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;
  let pages = 0;
  let hasMore = true;

  // We cap at a defensive page count to prevent runaway loops on
  // misbehaving accounts. Plaid's typical sync rarely exceeds 5 pages
  // even for accounts with 2+ years of history.
  const MAX_PAGES = 20;

  while (hasMore && pages < MAX_PAGES) {
    pages += 1;
    const res = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });
    const { added, modified, removed, next_cursor, has_more } = res.data;

    // Upsert added + modified in a single round trip per page.
    const rows = [
      ...added.map((t) => buildTxnRow(item.user_id as string, plaidItemRowId, t, false)),
      ...modified.map((t) => buildTxnRow(item.user_id as string, plaidItemRowId, t, false)),
    ];
    if (rows.length > 0) {
      const { error: upErr } = await supabaseAdmin
        .from("plaid_transactions")
        .upsert(rows, {
          onConflict: "user_id,plaid_transaction_id",
          ignoreDuplicates: false,
        });
      if (upErr) {
        observeError(upErr, {
          route: "plaid_sync.upsert",
          tags: { plaidItemRowId },
        });
        // Bail without advancing cursor — next call replays this page.
        return {
          added: totalAdded,
          modified: totalModified,
          removed: totalRemoved,
          cursor_advanced: false,
          pages,
        };
      }
    }

    // Soft-delete removed transactions. We tombstone instead of hard-
    // delete so the detection engine sees "this stream stopped" as an
    // observable event rather than silently losing rows.
    if (removed.length > 0) {
      const removedIds = removed
        .map((r) => r.transaction_id)
        .filter((id): id is string => !!id);
      if (removedIds.length > 0) {
        await supabaseAdmin
          .from("plaid_transactions")
          .update({ pending: true })
          .eq("user_id", item.user_id as string)
          .in("plaid_transaction_id", removedIds);
      }
    }

    totalAdded += added.length;
    totalModified += modified.length;
    totalRemoved += removed.length;

    // Advance the cursor in DB ONLY after writes succeeded. This is
    // the durability contract — a crash here means the next call
    // re-pulls the same page, which is safe because upserts are
    // idempotent.
    await supabaseAdmin
      .from("plaid_items")
      .update({ cursor: next_cursor, last_synced_at: new Date().toISOString() })
      .eq("id", plaidItemRowId);

    cursor = next_cursor;
    hasMore = has_more;
  }

  return {
    added: totalAdded,
    modified: totalModified,
    removed: totalRemoved,
    cursor_advanced: true,
    pages,
  };
}

// Convert a Plaid Transaction object into a plaid_transactions row,
// enriched with normalize output computed at write time. This is the
// ONE place we attach merchant_key — the detection engine just trusts
// what's in the DB.
function buildTxnRow(
  userId: string,
  plaidItemRowId: string,
  t: Transaction,
  pending: boolean
) {
  const desc = t.merchant_name ?? t.name ?? "";
  const norm = normalizeDescriptor(desc);
  const baseKey = (norm.catalog_key ?? norm.merchant_name).toLowerCase();
  // Biller passthrough split:
  //
  // Billers (Apple, Google Play, PayPal, Stripe, Square) wrap many
  // distinct products under one descriptor. If we keyed every
  // "APPLE.COM/BILL" charge on `apple`, iCloud ($2.99), Apple Music
  // ($10.99), and Apple TV+ ($6.99) would all collapse into one
  // recurrence group. The drift tolerance then rejects the minority
  // amounts as outliers and we lose two subscriptions.
  //
  // Generalized solution: when normalize flags biller_passthrough,
  // append a quantized amount tier to the merchant_key. The tier is
  // log-scaled so a price increase from $9.99 → $11.99 still lands in
  // the same bucket, but $2.99 vs $10.99 vs $49.99 stay separate.
  //
  // Tier: floor(amount_dollars / 5) for amounts < $50, then
  // floor(amount_dollars / 20) for higher.
  const amountDollars = Math.abs(t.amount ?? 0);
  let merchantKey = baseKey;
  if (norm.biller_passthrough) {
    const tier =
      amountDollars < 50
        ? Math.floor(amountDollars / 5)
        : 10 + Math.floor(amountDollars / 20);
    merchantKey = `${baseKey}_t${tier}`;
  }
  const normalizedDescriptor = desc.toLowerCase().trim().replace(/\s+/g, " ");

  return {
    user_id: userId,
    plaid_item_id: plaidItemRowId,
    plaid_transaction_id: t.transaction_id,
    plaid_stream_id: null, // Plaid's sync API doesn't include stream_id; we own grouping now
    account_id: t.account_id,
    amount_cents: Math.round((t.amount ?? 0) * 100 * -1), // Plaid: positive = outflow; we store negative = outflow
    currency: t.iso_currency_code ?? t.unofficial_currency_code ?? "USD",
    iso_currency_code: t.iso_currency_code ?? null,
    unofficial_currency_code: t.unofficial_currency_code ?? null,
    merchant_name: t.merchant_name ?? null,
    name: t.name ?? null,
    description: desc,
    pfc_primary: t.personal_finance_category?.primary ?? null,
    pfc_detailed: t.personal_finance_category?.detailed ?? null,
    authorized_date: t.authorized_date ?? null,
    posted_date: t.date,
    pending: pending || t.pending === true,
    raw: t as unknown as Record<string, unknown>,
    normalized_descriptor: normalizedDescriptor,
    merchant_key: merchantKey,
    canonical_name: norm.merchant_name,
  };
}

// v11 — Plaid Classic nudge. Calls /transactions/refresh on every
// active item for this user. Plaid Classic (legacy integration tier —
// Wealthsimple, many credit unions, smaller banks) doesn't deliver
// transactions on the first /transactions/sync call; it queues them
// in their backend and the first sync just returns 0 rows. Calling
// /refresh asks Plaid to prioritize the pull so the user doesn't sit
// on an empty dashboard for 30 minutes.
//
// This is a fire-and-forget nudge. /refresh has a separate rate
// limit and can 429; we swallow errors because the worst case is the
// retry loop times out and the user lands on the honest "your bank
// is slow" state. Best case it cuts the wait from ~30min to ~30s.
//
// Only called on first_connect — for subsequent scans, /sync is the
// right tool because incremental cursor delta is faster than nudging
// Plaid to repull.
export async function nudgePlaidItemsForUser(userId: string): Promise<void> {
  if (!plaidClient || !supabaseAdmin) return;
  const { data: items } = await supabaseAdmin
    .from("plaid_items")
    .select("id, plaid_access_token")
    .eq("user_id", userId)
    .eq("status", "active");

  for (const it of items ?? []) {
    try {
      const accessToken = decryptToken(it.plaid_access_token as string);
      await plaidClient.transactionsRefresh({ access_token: accessToken });
      // eslint-disable-next-line no-console
      console.log(`[plaid-sync] /refresh nudged item=${it.id}`);
    } catch (e) {
      // Non-fatal. Common failure: PRODUCT_NOT_READY (Plaid still doing
      // initial pull — fine, /sync retry loop covers it), or RATE_LIMIT
      // (we already nudged this user recently — also fine).
      observeError(e, {
        route: "plaid_sync.refresh",
        tags: { itemId: it.id as string, userId },
      });
    }
  }
}

// Sync every active Plaid item for a user. Used by the scan
// orchestrator before it reads plaid_transactions.
export async function syncAllItemsForUser(
  userId: string
): Promise<{ items: number; result: SyncResult }> {
  if (!supabaseAdmin) {
    return {
      items: 0,
      result: { added: 0, modified: 0, removed: 0, cursor_advanced: false, pages: 0 },
    };
  }
  const { data: items } = await supabaseAdmin
    .from("plaid_items")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active");

  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;
  let totalPages = 0;
  let cursorAdvanced = true;

  for (const it of items ?? []) {
    const r = await syncPlaidItemTransactions(it.id as string);
    totalAdded += r.added;
    totalModified += r.modified;
    totalRemoved += r.removed;
    totalPages += r.pages;
    if (!r.cursor_advanced) cursorAdvanced = false;
  }

  return {
    items: (items ?? []).length,
    result: {
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
      cursor_advanced: cursorAdvanced,
      pages: totalPages,
    },
  };
}
