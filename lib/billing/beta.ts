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
// beta-access? Defaults to TRUE so existing users keep working through
// the grandfather window below. New signups (after BETA_GRANDFATHER_
// CREATED_BEFORE) are NOT unlocked even when this is true — see
// isBetaUserOverride. To kill the unlock entirely (including for
// grandfathered users), set BETA_MODE_ENABLED=false in env.
export const BETA_MODE_ENABLED: boolean =
  process.env.BETA_MODE_ENABLED !== "false";

// ──────────────────────────────────────────────────────────────────
// GRANDFATHER CUTOFF — added 2026-06-05 during beta graduation.
// ──────────────────────────────────────────────────────────────────
// Frugavo graduates from beta on this date. Users who signed up
// BEFORE this cutoff keep their open beta_access ("Founder Access")
// indefinitely as a thank-you for testing the product. Users who
// signed up ON OR AFTER this date are NOT eligible for the beta
// unlock — they land in their real entitlement state (typically
// "none") and see the Activate Protection upgrade card with the
// two-tier pricing (Free $0 / Protection $4.99/mo).
//
// Why a date instead of a per-user flag:
//   - We don't need to coordinate a migration or backfill anything;
//     the timestamp already lives in Clerk's createdAt.
//   - Reverting (extending the grandfather window) is a one-line
//     change to the constant.
//   - Auditable: any user can read this file and know exactly when
//     the change happened and who it affected.
//
// Override knob: if you need a hand-picked cohort of new users to
// keep beta access (e.g. internal testers signing up after the
// cutoff), populate BETA_GRANDFATHER_CLERK_USER_IDS in env with a
// comma-separated list of Clerk user IDs.
export const BETA_GRANDFATHER_CREATED_BEFORE = new Date(
  "2026-06-05T00:00:00.000Z"
);

const explicitGrandfatherSet: ReadonlySet<string> = new Set(
  (process.env.BETA_GRANDFATHER_CLERK_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

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

// Decides whether a specific user is eligible for the beta unlock.
// Two paths grant eligibility:
//   1. Explicit allow-list (BETA_GRANDFATHER_CLERK_USER_IDS env var)
//      — wins regardless of signup date. Use for internal testers
//      who sign up after the cutoff but should keep open access.
//   2. Account created BEFORE BETA_GRANDFATHER_CREATED_BEFORE.
//      Existing beta users keep their "Founder Access" thank-you tier.
//
// userCreatedAt is REQUIRED for path (2). Callers that can't supply
// it (legacy / unauthenticated contexts) effectively skip the
// grandfather window — the user lands in their real entitlement
// state. This is the safe default for revenue logic: an unknown
// signup date is treated as a new signup.
function isBetaUserOverride(
  clerkUserId: string,
  userCreatedAt: Date | string | null | undefined
): boolean {
  if (explicitGrandfatherSet.has(clerkUserId)) return true;
  if (!userCreatedAt) return false;
  const created =
    userCreatedAt instanceof Date ? userCreatedAt : new Date(userCreatedAt);
  if (Number.isNaN(created.getTime())) return false;
  return created < BETA_GRANDFATHER_CREATED_BEFORE;
}

// Public — applied inside getEntitlement immediately before cache
// writes + returns. Idempotent: passing in a "beta_access" row
// returns it unchanged. Passing in a non-overridable state returns
// it unchanged.
//
// userCreatedAt is the user's Clerk account creation timestamp. When
// provided, drives the grandfather check (see isBetaUserOverride).
// When omitted/null, the beta unlock is SKIPPED unless the user is on
// the explicit allow-list. This keeps new signups (post-graduation)
// out of the unlock automatically.
export function applyBetaUnlock(
  ent: Entitlement,
  userCreatedAt?: Date | string | null
): Entitlement {
  if (!BETA_MODE_ENABLED) return ent;
  if (!OVERRIDABLE_STATES.has(ent.entitlement_state)) return ent;
  if (!isBetaUserOverride(ent.clerk_user_id, userCreatedAt)) return ent;
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
