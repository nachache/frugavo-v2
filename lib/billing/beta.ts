// Beta-access policy module.
//
// ──────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
// ──────────────────────────────────────────────────────────────────
// Frugavo is in early beta. The strategic priority is product-truth
// discovery, emotional resonance, retention, and trust formation —
// NOT revenue. Hard paywalls during this phase suppress exactly the
// signals we need to learn from.
//
// At the same time, the product must NOT feel "free." It should
// feel premium, early-access, founder-tier — like the user was
// lucky to get in. So we keep the premium architecture intact
// (entitlements, plans, billing, locked-card visual treatment) and
// inject a single override layer that:
//
//   • silently unlocks every gated capability for beta users
//   • re-labels the unlock as "Founder Access" / "Beta Protection
//     Active" everywhere it's surfaced
//   • leaves the real Stripe entitlements untouched — so when
//     monetization actually begins, flipping BETA_MODE_ENABLED to
//     false reverts every user to their real billing state with
//     zero data migration.
//
// One file owns the policy. When monetization starts, this is the
// only file we touch.
//
// ──────────────────────────────────────────────────────────────────
// HOW IT WORKS
// ──────────────────────────────────────────────────────────────────
// applyBetaUnlock(ent) is called by getEntitlement just before the
// row leaves the billing module. It inspects the REAL entitlement
// state and, if BETA_MODE_ENABLED is on AND the real state is
// "none" / "expired" / "past_due", returns a synthetic entitlement
// with state = "beta_access". A real trialing or active subscription
// is preserved as-is — someone who paid stays paid.
//
// "beta_access" is treated as access-granting by hasAccess(), and
// flagged as isEffectivelyPaid by every UI gate. But it's also
// recognizable by isBetaAccess() so surfaces that should look
// different ("Founder Access" pill instead of "Protected since…")
// can route on it.
//
// ──────────────────────────────────────────────────────────────────
// FLIPPING IT OFF LATER
// ──────────────────────────────────────────────────────────────────
//   1. Set BETA_MODE_ENABLED=false in the environment.
//   2. Deploy. Every user's effective entitlement reverts to their
//      real Stripe state. Beta users who haven't subscribed will
//      see "none" and the upgrade architecture re-engages.
//   3. Optionally: keep the env var on for a hand-picked beta
//      cohort by adding a per-user override here. We left
//      isBetaUserOverride() as a hook for that.

import type { Entitlement, EntitlementState } from "@/lib/billing/entitlements";

// Boolean — does the deploy treat unauthenticated/free users as
// beta-access? Defaults to TRUE for the current beta phase. To turn
// it off in production, set BETA_MODE_ENABLED=false in env. We
// deliberately default ON so the right state ships even if the env
// var hasn't been wired into a new environment yet.
export const BETA_MODE_ENABLED: boolean =
  process.env.BETA_MODE_ENABLED !== "false";

// States the beta unlock can OVERRIDE. We preserve a real paid
// subscription (trialing, active, grace_period, cancelled_active) —
// someone who's actually paying stays in their real state. The
// unlock only fires when the user has nothing real OR their real
// access ended.
const OVERRIDABLE_STATES: ReadonlySet<EntitlementState> = new Set([
  "none",
  "expired",
  "past_due",
]);

// Hook for per-user beta overrides. We don't read from a database
// here because the canonical entitlement query already hit Postgres
// once — adding another lookup per request defeats the cache. If
// you want a tighter cohort during beta, drop logic here that reads
// from an in-memory allowlist (env-injected) or a Redis set.
//
// Currently a constant `true`: every user with an overridable state
// gets the unlock when BETA_MODE_ENABLED is on.
function isBetaUserOverride(_clerkUserId: string): boolean {
  void _clerkUserId;
  return true;
}

// Public — applied inside getEntitlement immediately before cache
// writes + returns. Idempotent: passing in a "beta_access" row
// returns it unchanged. Passing in a non-overridable state returns
// it unchanged.
export function applyBetaUnlock(ent: Entitlement): Entitlement {
  if (!BETA_MODE_ENABLED) return ent;
  if (!OVERRIDABLE_STATES.has(ent.entitlement_state)) return ent;
  if (!isBetaUserOverride(ent.clerk_user_id)) return ent;
  return {
    ...ent,
    entitlement_state: "beta_access",
    // We intentionally do NOT populate trial_ends_at or expires_at
    // — beta access has no expiry by design. Downstream code that
    // reads expires_at against now() will see null and treat it as
    // open-ended.
    trial_ends_at: null,
    expires_at: null,
    source_event_id: "beta:auto-unlock",
  };
}

// True when the user is accessing the product via the beta unlock,
// not via a real Stripe subscription. Drives UI differentiation
// ("Founder Access" pill, no upgrade CTAs, no trial-converting
// warning emails, etc).
export function isBetaAccess(ent: Pick<Entitlement, "entitlement_state">): boolean {
  return ent.entitlement_state === "beta_access";
}

// True when the user has access to gated functionality for any
// reason — real Stripe subscription OR beta unlock. EVERY existing
// "are they paid?" gate should migrate to this helper so the right
// thing happens automatically when BETA_MODE flips.
//
// IMPORTANT — semantics:
//   This returns true for: trialing | active | cancelled_active |
//   beta_access. It does NOT include grace_period (technically they
//   still have access, but the dunning UI must be shown) or
//   past_due (the dunning banner is the right surface).
//
//   Use hasAccess() (in entitlements.ts) when the question is "can
//   they actually USE this right now?" Use isEffectivelyPaid() when
//   the question is "should the upgrade CTA be hidden?"
export function isEffectivelyPaid(
  ent: Pick<Entitlement, "entitlement_state">
): boolean {
  return (
    ent.entitlement_state === "trialing" ||
    ent.entitlement_state === "active" ||
    ent.entitlement_state === "cancelled_active" ||
    ent.entitlement_state === "beta_access"
  );
}
