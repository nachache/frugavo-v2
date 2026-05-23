// Shared types for the Peace of Mind monitoring layer.

export type AlertType =
  | "new_subscription"
  | "price_increase"
  | "renewal_upcoming"
  | "dormant_resumed"
  | "high_charge_amount"
  | "trial_converting"
  | "missing_renewal"
  | "duplicate_subscription";

export type AlertSeverity = "info" | "notice" | "urgent";

export type AlertStatus =
  | "active"
  | "acknowledged"
  | "dismissed"
  | "resolved";

// Candidate alert produced by a detector. The orchestrator upserts
// these into monitoring_alerts keyed by (user_id, dedup_key).
export type CandidateAlert = {
  alert_type: AlertType;
  severity: AlertSeverity;
  dedup_key: string;
  subscription_id?: string | null;
  merchant_key?: string | null;
  merchant_name?: string | null;
  details: Record<string, unknown>;
};

// Persisted alert row shape (mirrors monitoring_alerts).
export type Alert = CandidateAlert & {
  id: string;
  user_id: string;
  status: AlertStatus;
  created_at: string;
  updated_at: string;
};
