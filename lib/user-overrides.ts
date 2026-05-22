// Per-user override store.
//
// Sits at the TOP of the scoring stack: when a user has explicitly
// labelled a merchant, that label wins outright over any probability.
//
// One active row per (user_id, merchant_key) — a fresh label upserts
// the previous one. The feedback endpoint also appends an immutable
// row to feedback_events for retraining, so we don't lose label
// history when overrides change.
//
// Reads are cached as a per-user map keyed by merchant_key, so the
// scoring hot path is a single Redis hit per user (not per merchant).

import { supabaseAdmin } from "./supabase";
import { cacheGet, cacheSet, cacheDel, cacheKey } from "./cache";
import type { UserOverride } from "./scoring";

const USER_OVERRIDES_TTL_SECONDS = 60 * 60; // 1h

export type UserOverrideRow = UserOverride & {
  subscription_id: string | null;
  merchant_key: string;
  created_at: string;
  updated_at: string;
};

// Cache shape: a plain object map keyed by merchant_key. Easier to
// JSON-serialize than a Map.
type OverrideMap = Record<string, UserOverrideRow>;

// ───────────────────────────────────────────────────────────────────
// Read
// ───────────────────────────────────────────────────────────────────

/**
 * All overrides for a given user, keyed by merchant_key. Result is
 * cached for an hour; the feedback endpoint invalidates this key on
 * every write.
 */
export async function getOverridesForUser(
  userId: string
): Promise<Map<string, UserOverrideRow>> {
  const cached = await cacheGet<OverrideMap>(cacheKey.userOverrides(userId));
  if (cached) return new Map(Object.entries(cached));

  if (!supabaseAdmin) return new Map();
  const { data } = await supabaseAdmin
    .from("user_overrides")
    .select(
      "subscription_id, merchant_key, override_type, override_value, created_at, updated_at"
    )
    .eq("user_id", userId);

  const map = new Map<string, UserOverrideRow>();
  for (const row of (data ?? []) as Array<{
    subscription_id: string | null;
    merchant_key: string;
    override_type: UserOverride["override_type"];
    override_value: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>) {
    map.set(row.merchant_key, {
      subscription_id: row.subscription_id,
      merchant_key: row.merchant_key,
      override_type: row.override_type,
      override_value: row.override_value ?? {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  const asObj: OverrideMap = {};
  for (const [k, v] of map) asObj[k] = v;
  await cacheSet(cacheKey.userOverrides(userId), asObj, USER_OVERRIDES_TTL_SECONDS);
  return map;
}

/**
 * Single-merchant override lookup. Convenience helper for hot path.
 */
export async function getOverride(
  userId: string,
  merchantKey: string
): Promise<UserOverrideRow | null> {
  const all = await getOverridesForUser(userId);
  return all.get(merchantKey) ?? null;
}

// ───────────────────────────────────────────────────────────────────
// Write
// ───────────────────────────────────────────────────────────────────

/**
 * Upserts a user override. Returns the persisted row.
 * Invalidates the user's cache so the next read sees the new label.
 */
export async function writeOverride(args: {
  user_id: string;
  subscription_id: string | null;
  merchant_key: string;
  override_type: UserOverride["override_type"];
  override_value?: Record<string, unknown>;
}): Promise<UserOverrideRow | null> {
  if (!supabaseAdmin) return null;
  const {
    user_id,
    subscription_id,
    merchant_key,
    override_type,
    override_value = {},
  } = args;
  const { data, error } = await supabaseAdmin
    .from("user_overrides")
    .upsert(
      {
        user_id,
        subscription_id,
        merchant_key,
        override_type,
        override_value,
      },
      { onConflict: "user_id,merchant_key" }
    )
    .select(
      "subscription_id, merchant_key, override_type, override_value, created_at, updated_at"
    )
    .single();
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[user-overrides] write failed", error);
    return null;
  }
  await cacheDel(cacheKey.userOverrides(user_id));
  return {
    subscription_id: data.subscription_id as string | null,
    merchant_key: data.merchant_key as string,
    override_type: data.override_type as UserOverride["override_type"],
    override_value: (data.override_value ?? {}) as Record<string, unknown>,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

/**
 * Explicit cache bust — exported so the feedback endpoint can
 * invalidate after multi-step writes that touch overrides and
 * subscriptions together.
 */
export async function invalidateUserOverridesCache(userId: string): Promise<void> {
  await cacheDel(cacheKey.userOverrides(userId));
}

/**
 * Hard delete (rare path — only when a user wants to clear a label).
 * The feedback_events row remains for audit.
 */
export async function deleteOverride(args: {
  user_id: string;
  merchant_key: string;
}): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from("user_overrides")
    .delete()
    .eq("user_id", args.user_id)
    .eq("merchant_key", args.merchant_key);
  await cacheDel(cacheKey.userOverrides(args.user_id));
}
