// Notification primitives.
//
// Mirrors the alert types defined in lib/monitoring/types.ts but
// adds notification-specific concepts: urgent vs digest channels,
// per-user preferences, and dispatch records.

import type { Alert, AlertType } from "@/lib/monitoring/types";
import { isPrimary } from "@/lib/monitoring/tiers";

// Alert types that bypass the digest and send immediately. Per user
// answer: trial converting, price increase >20%, charge spike,
// duplicate subscription.
export const URGENT_ALERT_TYPES: AlertType[] = [
  "trial_converting",
  "high_charge_amount",
  "duplicate_subscription",
  // price_increase only when severity is 'urgent' — see isUrgent()
  "price_increase",
];

// Digest cadence — how often non-urgent alerts are bundled. Urgent
// alerts (controlled separately by urgent_immediate_enabled) ignore
// this and fire instantly regardless.
//
// 'off' means no digest at all — urgent alerts still fire if that
// toggle is on, but everything else stays silent.
export type DigestCadence = "daily" | "weekly" | "monthly" | "off";

export type NotificationPreferences = {
  user_id: string;
  email_enabled: boolean;
  // Retained for backward compat; new code should read digest_cadence.
  // True iff digest_cadence !== 'off'.
  digest_enabled: boolean;
  digest_cadence: DigestCadence;
  urgent_immediate_enabled: boolean;
  enabled_types: Record<string, boolean>;
  quiet_hours_local: string | null;
  global_unsubscribed_at: string | null;
};

export const DEFAULT_PREFS: Omit<NotificationPreferences, "user_id"> = {
  email_enabled: true,
  digest_enabled: true,
  digest_cadence: "weekly",
  urgent_immediate_enabled: true,
  enabled_types: {
    new_subscription: true,
    price_increase: true,
    renewal_upcoming: true,
    dormant_resumed: true,
    high_charge_amount: true,
    trial_converting: true,
    missing_renewal: true,
    duplicate_subscription: true,
  },
  quiet_hours_local: null,
  global_unsubscribed_at: null,
};

export type DispatchRecord = {
  user_id: string;
  alert_id: string | null;
  digest_key: string | null;
  channel: "email" | "push" | "sms";
  send_kind: "urgent" | "digest";
  to_email: string;
  subject: string;
  provider_id?: string | null;
  status: "sent" | "failed";
  error_msg?: string | null;
};

// Decides if a given alert should bypass the digest and fire an
// urgent push/email. Combines:
//   1. Tier gate — only PRIMARY alerts are ever allowed to be
//      urgent. Secondary alerts go to the dashboard quietly,
//      silent alerts go nowhere visible. See lib/monitoring/tiers.ts.
//   2. Type-based escalation — within the primary tier, certain
//      types are always urgent (trial conversion, high charge).
//   3. Severity check — a 6% price increase is not urgent enough
//      to interrupt; a 25% one is.
export function isUrgent(alert: Alert): boolean {
  // Tier gate — demoted detectors NEVER fire urgent.
  if (!isPrimary(alert.alert_type)) return false;
  if (alert.alert_type === "trial_converting") return true;
  if (alert.alert_type === "high_charge_amount") return true;
  if (alert.alert_type === "price_increase") {
    const pct = (alert.details?.delta_pct as number | undefined) ?? 0;
    return pct >= 0.2;
  }
  return alert.severity === "urgent";
}
