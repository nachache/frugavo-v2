// Entitlement read API — the ONLY thing the request hot path touches.
//
// Every gated route calls hasAccess(userId) on each request. We
// service that from a 30-second Redis cache, falling back to one
// Postgres SELECT on miss. No Stripe API calls. Ever.
//
// The 30s TTL is a deliberate trade-off: if a user just paid, they
// may see "no access" for up to 30 seconds before the cache expires
// and the new entitlement row is read. The post-payment success
// page (PR 5) handles this by polling /api/billing/check, which
// invalidates the cache explicitly when it sees the entitlement
// flip — so the user-visible delay is sub-second.

import { supabaseAdmin } from "@/lib/supabase";
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache";
import { applyBetaUnlock } from "@/lib/billing/beta";

export type EntitlementState =
  | "none"
  | "trialing"
  | "active"
  | "grace_period"
  | "cancelled_active"
  | "past_due"
  | "expired"
  // Synthetic state injected by lib/billing/beta.ts during the
  // current beta phase. Treated as access-granting by hasAccess(),
  // flagged as effectively-paid by isEffectivelyPaid(), but
  // recognizable by isBetaAccess() so UI surfaces can render the
  // "Founder Access" framing instead of the standard paid pill.
  // Will no longer be returned once BETA_MODE_ENABLED flips false.
  | "beta_access";

export type Entitlement = {
  clerk_user_id: string;
  feature: string;
  entitlement_state: EntitlementState;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  expires_at: string | null;
  source_event_id: string | null;
};

const CACHE_TTL_SECONDS = 30;

// States that grant access. cancelled_active = user cancelled but
// their paid period hasn't ended yet — they keep access until
// expires_at, then transition to expired and lose it.
// grace_period = payment failed, but within the 21-day dunning
// window. Both states carry an expires_at; hasAccess re-checks it
// against now() so the cutoff is correct even before the reconciler
// cron (PR 8) updates the persisted state.
const ACCESS_GRANTING: ReadonlySet<EntitlementState> = new Set([
  "trialing",
  "active",
  "grace_period",
  "cancelled_active",
  "beta_access",
]);

const TIME_LIMITED: ReadonlySet<EntitlementState> = new Set([
  "grace_period",
  "cancelled_active",
]);

function cacheKey(clerkUserId: string, feature: string): string {
  return `billing:ent:v1:${feature}:${clerkUserId}`;
}

// The canonical access check. Everything that gates a feature on
// the paid plan eventually calls this.
//
// `feature` defaults to "peace_of_mind" since that's our only tier
// at launch; the parameter exists so future tiers (e.g. "family",
// "business") don't require an API change.
export async function hasAccess(
  clerkUserId: string,
  feature: string = "peace_of_mind"
): Promise<boolean> {
  const ent = await getEntitlement(clerkUserId, feature);
  if (!ACCESS_GRANTING.has(ent.entitlement_state)) return false;
  // Time-limited states (grace_period, cancelled_active) have an
  // expires_at. If it's in the past, the persisted state is stale
  // (reconciler hasn't run yet); deny access at read time.
  if (TIME_LIMITED.has(ent.entitlement_state) && ent.expires_at) {
    if (new Date(ent.expires_at).getTime() < Date.now()) {
      return false;
    }
  }
  return true;
}

export async function getEntitlement(
  clerkUserId: string,
  feature: string = "peace_of_mind"
): Promise<Entitlement> {
  const key = cacheKey(clerkUserId, feature);

  // Cache lookup. We cache even the "none" state so a free user
  // doesn't hit Postgres on every page load.
  const cached = await cacheGet<Entitlement>(key);
  if (cached) return cached;

  // Cache miss: read Postgres.
  if (!supabaseAdmin) {
    throw new Error("[billing] supabaseAdmin not configured");
  }
  const { data, error } = await supabaseAdmin
    .from("billing_entitlements")
    .select(
      "clerk_user_id, feature, entitlement_state, stripe_subscription_id, trial_ends_at, expires_at, source_event_id"
    )
    .eq("clerk_user_id", clerkUserId)
    .eq("feature", feature)
    .maybeSingle();

  if (error) {
    throw new Error(`[billing] getEntitlement query failed: ${error.message}`);
  }

  const rawRow: Entitlement = data ?? {
    // No row yet → user has never started a trial.
    clerk_user_id: clerkUserId,
    feature,
    entitlement_state: "none",
    stripe_subscription_id: null,
    trial_ends_at: null,
    expires_at: null,
    source_event_id: null,
  };

  // Beta unlock — applied here so EVERY caller sees the synthetic
  // beta_access state without each having to compose the policy.
  // Real paid subscriptions pass through unchanged; only states in
  // the overridable set (none / expired / past_due) get rewritten.
  // When BETA_MODE_ENABLED flips false, this becomes a no-op.
  const row = applyBetaUnlock(rawRow);

  // Don't cache "expired" / "past_due" states for the full 30s —
  // those are recoverable (the user might restart their plan in
  // seconds and we want them to see the change). Cap at 5s.
  // beta_access is open-ended and safe to cache for the full TTL.
  const ttl =
    row.entitlement_state === "expired" || row.entitlement_state === "past_due"
      ? 5
      : CACHE_TTL_SECONDS;
  await cacheSet(key, row, ttl);

  return row;
}

// Explicit cache bust. Call this from the webhook handler after
// projecting a state change, and from the /api/billing/check
// success-page poller so the next dashboard render sees the new
// entitlement immediately.
export async function invalidateEntitlementCache(
  clerkUserId: string,
  feature: string = "peace_of_mind"
): Promise<void> {
  await cacheDel(cacheKey(clerkUserId, feature));
}
