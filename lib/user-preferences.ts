// Per-user preferences store. Single jsonb blob keyed by Clerk
// user_id. Extending preferences never requires a schema change —
// just add a new field on the client.
//
// Caches reads in Redis with a 5-minute TTL. Writes invalidate.

import { supabaseAdmin } from "./supabase";
import { cacheGet, cacheSet, cacheDel } from "./cache";

const PREFS_TTL_SECONDS = 5 * 60;

export type UserPreferences = {
  // ActionCenter UI state.
  action_center_tab?: "worth" | "watching" | "pruned" | "hidden" | "all";
  action_center_sort?: "price" | "age" | "category";
  // Future: theme, default chart range, dismissed insights, etc.
  [k: string]: unknown;
};

function cacheKeyFor(userId: string): string {
  return `prefs:v1:${userId}`;
}

export async function getUserPreferences(
  userId: string
): Promise<UserPreferences> {
  const cached = await cacheGet<UserPreferences>(cacheKeyFor(userId));
  if (cached) return cached;
  if (!supabaseAdmin) return {};
  const { data } = await supabaseAdmin
    .from("user_preferences")
    .select("prefs")
    .eq("user_id", userId)
    .maybeSingle();
  const prefs = (data?.prefs ?? {}) as UserPreferences;
  await cacheSet(cacheKeyFor(userId), prefs, PREFS_TTL_SECONDS);
  return prefs;
}

export async function patchUserPreferences(
  userId: string,
  patch: UserPreferences
): Promise<UserPreferences> {
  if (!supabaseAdmin) return patch;
  // Read-modify-write. Race window is tiny because each user is the
  // only writer for their own row; if two browser tabs collide the
  // last write wins (acceptable for UI prefs).
  const current = await getUserPreferences(userId);
  const merged = { ...current, ...patch };
  await supabaseAdmin
    .from("user_preferences")
    .upsert(
      { user_id: userId, prefs: merged },
      { onConflict: "user_id" }
    );
  await cacheDel(cacheKeyFor(userId));
  return merged;
}
