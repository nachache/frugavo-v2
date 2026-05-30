// Detector tier framework — single source of truth for how much
// "voice" each alert type is allowed to have in the product.
//
// Principle: every new detector ships at "secondary" by default. It
// is promoted to "primary" only after measured precision against
// real user feedback. Today every detector shipped at maximum
// visibility regardless of accuracy — that's the root cause of the
// alert-fatigue trust problem.
//
// Tiers:
//   primary   — full voice. Eligible for urgent push/email. Counted
//               in the dashboard LIVE pill. Shows above the fold in
//               /app/noticed. The user's first impression.
//   secondary — quiet voice. Never emails. Not counted in the LIVE
//               pill. Shows in a collapsed "Other things we noticed"
//               section in /app/noticed only. The user can opt in.
//   silent    — no UI voice. Detector still runs and writes to
//               monitoring_alerts (so we can measure + improve), but
//               it never appears in the alerts feed. Some types may
//               be surfaced inline elsewhere (e.g. inside a per-sub
//               detail overlay as a contextual question).
//
// Demotion is the cheap reversible alternative to deletion. When a
// detector's accuracy improves enough that promotion is warranted,
// flip its tier here and the rest of the product reacts.

export type AlertTier = "primary" | "secondary" | "silent";

// Edit this map to demote / promote any alert type. Nothing else
// should hardcode these strings.
export const ALERT_TIER: Record<string, AlertTier> = {
  // ─── Primary ────────────────────────────────────────────────
  price_increase: "primary",
  dormant_resumed: "primary",
  trial_converting: "primary",
  new_subscription: "primary",
  renewal_upcoming: "primary",
  high_charge_amount: "primary",

  // ─── Secondary (demoted) ────────────────────────────────────
  // Duplicate detection's first-word root matching produces ~40%
  // false positives (Apple Music + Apple TV → same "apple" root).
  // Demoted until a semantic merchant clusterer ships. The "Not a
  // duplicate" feedback button on each row feeds the future v2.
  duplicate_subscription: "secondary",

  // ─── Silent (further demoted) ───────────────────────────────
  // Missing renewal's 3–21 day window catches ~35% noise from
  // billing-day shifts and silent cancellations. Removed from the
  // alerts feed entirely. The per-sub detail overlay surfaces the
  // same data inline as a contextual "Did you cancel this?"
  // question, where it has an obvious answer instead of joining
  // an anxious notification stream.
  missing_renewal: "silent",
};

export function tierFor(alertType: string): AlertTier {
  return ALERT_TIER[alertType] ?? "secondary";
}

export function isPrimary(alertType: string): boolean {
  return tierFor(alertType) === "primary";
}

export function isSecondary(alertType: string): boolean {
  return tierFor(alertType) === "secondary";
}

export function isSilent(alertType: string): boolean {
  return tierFor(alertType) === "silent";
}
