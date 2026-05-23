// Notification primitives.
//
// Mirrors the alert types defined in lib/monitoring/types.ts but
// adds notification-specific concepts: urgent vs digest channels,
// per-user preferences, and dispatch records.

import type { Alert, AlertType } from "@/lib/monitoring/types";

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

export type NotificationPreferences = {
  user_id: string;
  email_enabled: boolean;
  digest_enabled: boolean;
  urgent_immediate_enabled: boolean;
  enabled_types: Record<string, boolean>;
  quiet_hours_local: string | null;
  global_unsubscribed_at: string | null;
};

export const DEFAULT_PREFS: Omit<NotificationPreferences, "user_id"> = {
  email_enabled: true,
  digest_enabled: true,
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

// Decides if a given alert should bypass the digest. Combines the
// type-based URGENT list with a severity check — a 6% price increase
// is not urgent enough to interrupt; a 25% one is.
export function isUrgent(alert: Alert): boolean {
  if (alert.alert_type === "trial_converting") return true;
  if (alert.alert_type === "high_charge_amount") return true;
  if (alert.alert_type === "duplicate_subscription") return true;
  if (alert.alert_type === "price_increase") {
    const pct = (alert.details?.delta_pct as number | undefined) ?? 0;
    return pct >= 0.2;
  }
  return alert.severity === "urgent";
}
