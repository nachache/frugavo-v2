// Surface-level feature flags. Read-only constants. Flip a flag,
// rebuild, deploy — no per-user state, no DB writes, no fetches.
//
// These exist to keep "hide / unhide" decisions a one-line edit
// instead of code-archaeology. When a flag flips, every dependent
// surface inherits the change because they all import the same const.

// ─── Bills surface (v5) ─────────────────────────────────────────────
//
// false: dashboard hides the Bills tab + the "Mark as a bill" /
//   "Move to subscriptions" row affordances. Subscription totals
//   already exclude bills (lib/insights.ts → computeBurnRate splits
//   on recurring_type, monthly_cents is subs-only), so headline
//   numbers stay correct.
//
// Engine behavior is UNCHANGED — bills still get detected, tiered,
// and persisted to the `subscriptions` table with
// recurring_type='recurring_bill'. Flipping this flag back to true
// re-exposes them across every surface with no migration, no
// re-scan.
//
// Why hidden by default: the launch product is "what can I cut?" —
// bills aren't cancellable in the same way and dilute the message.
// Unhide once the bill-management story is ready.
export const SHOW_BILLS_SURFACE = false;
