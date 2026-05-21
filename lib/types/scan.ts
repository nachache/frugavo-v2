// Shared SSE wire types for the scan stream. Both the worker (publisher)
// and the SSE endpoint + browser client (consumers) import from here so
// the shape stays in lockstep.

export type Frequency =
  | "weekly"
  | "biweekly"
  | "semi_monthly"
  | "monthly"
  | "quarterly"
  | "annually"
  | "unknown";

// Provenance for the merchant_name + category attached to a row.
//   catalog → deterministic lookup hit lib/data/merchant-catalog.json
//   llm     → Haiku resolved it (catalog miss). temperature: 0.
//   plaid   → Plaid's merchant_name field (LLM unavailable)
//   raw     → fell back to the bank descriptor verbatim
//   unknown → nothing produced a name
export type AiSource = "catalog" | "llm" | "plaid" | "raw" | "unknown";

export type ScanRow = {
  stream_id: string;
  merchant_name: string;
  raw_descriptor: string;
  amount_cents: number;
  currency: string;
  frequency: Frequency;
  last_charged_at: string | null;
  next_expected_charge_at: string | null;
  regret_score: number; // 0..100
  category: string | null;
  ai_source: AiSource;
};

export type ScanPhase = "connecting" | "reading" | "spotting";

export type ScanErrorCode =
  | "plaid_timeout"
  | "item_login_required"
  | "rate_limited"
  | "internal";

export type ScanEvent =
  | { type: "row"; scan_id: string; row: ScanRow }
  | {
      type: "total";
      scan_id: string;
      monthly_cents: number;
      count: number;
    }
  | { type: "progress"; scan_id: string; phase: ScanPhase }
  | {
      type: "complete";
      scan_id: string;
      detected: number;
      failed: number;
      duration_ms: number;
    }
  | {
      type: "error";
      scan_id: string;
      code: ScanErrorCode;
      recoverable: boolean;
      message?: string;
    }
  | { type: "heartbeat"; ts: number };

// Latency budget constants — referenced by both UI and tests so a tuning
// change updates both surfaces in one PR.
export const SCAN_BUDGET_MS = {
  firstRowP50: 2_500,
  firstRowP95: 7_000,
  hardCeiling: 10_000,
  fallbackDetach: 8_000,
  aiTimeoutPerRow: 800,
  rescanCooldown: 30_000,
  sseHeartbeat: 15_000,
  sseReplayWindow: 60_000,
} as const;
