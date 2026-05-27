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
  // Phase D — when present, the scan-reveal UI renders inline doubt
  // chips below the row (Real / Not a sub / Shared / Skip). The id
  // is the doubt_items.id the chips post their answer to. Absent
  // when the candidate auto-confirmed (confidence ≥ 0.85) or fell
  // outside the scan-chip surface zone (≥ 0.55 → dashboard module).
  doubt_item_id?: string | null;
  // Engine confidence 0..1. Surfaced so the UI can visually weight
  // low-confidence rows even before the chip is answered.
  confidence?: number | null;
  // Plaid-style hint for chip copy variants. 'sometimes' is the
  // case where the prompt reads best as "Real subscription or
  // one-off?"; 'always' (rare in the doubt surface) reads as
  // "Confirm this charge". Optional, used by Phase D copy.
  brand_likelihood?: "always" | "sometimes" | "never" | null;
};

// v9 — 5-beat narrative phases. Each maps to a real engine stage so
// the loading UI's text/visual transitions are tied to real backend
// progress. Splits the legacy "spotting" into detection + classify
// so the user gets two extra real-signal advance points during the
// wait. The wait of 15-45s now has 5 honest acts instead of 3.
export type ScanPhase =
  | "connecting"   // beat 1 — Plaid item active, sync about to start
  | "reading"      // beat 2 — transactions arriving from Plaid
  | "spotting"     // beat 3 — engine grouping + detecting cadence
  | "identifying"  // beat 4 — classifier deciding what's a sub
  | "counting";    // beat 5 — final totals being computed

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
  // v11 — Plaid Classic / slow-bank state. Emitted when a first_connect
  // scan exhausts its sync retry budget without Plaid delivering ANY
  // transactions yet. The bank (typically Wealthsimple, some credit
  // unions, anything on Plaid's "Classic" integration tier) genuinely
  // hasn't released history. Honest UX: tell the user, stop pretending
  // we'll have data in 5 more seconds. The webhook handler will catch
  // SYNC_UPDATES_AVAILABLE / INITIAL_UPDATE and re-trigger the scan
  // when Plaid eventually delivers — could be minutes, could be hours.
  | {
      type: "awaiting_bank_data";
      scan_id: string;
      bank_name?: string | null;
      // Approximate ETA from Plaid Classic experience. Used by the UI
      // to set expectations honestly rather than a generic "soon".
      estimated_wait_minutes?: number;
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
