// Schema for the immutable per-scan snapshot. Lives here so the server
// (lib/scan.ts) and the client (app/app/page.tsx → SubscriptionList)
// agree on shape without one side drifting.
//
// A snapshot is an array of these rows + scalar aggregates, stored as
// JSONB on scan_snapshots.payload. Every row is what the engine
// "decided" about one detected stream — merchant, money, classifier
// verdict, normalization provenance.
//
// User decisions (keep / cancel) are NOT in the snapshot. They live on
// the mutable `subscriptions` table keyed by plaid_stream_id and are
// joined on read so a "cancelled" decision persists across scans.

export type SnapshotRow = {
  // Stable across scans for the same underlying recurring stream.
  // Production: Plaid's stream_id. Sandbox demo path: derived from the
  // normalized merchant key.
  plaid_stream_id: string;
  // Display values.
  merchant_name: string;
  category: string;
  // Money — cents to avoid float jitter splitting groups.
  amount_cents: number;
  currency: string;
  frequency:
    | "weekly"
    | "biweekly"
    | "semi_monthly"
    | "monthly"
    | "quarterly"
    | "annually"
    | "unknown";
  monthly_equivalent_cents: number;
  // Dates.
  last_charged_at: string | null;
  next_expected_charge_at: string | null;
  // Engine state.
  classification: "confirmed" | "needs_review" | "rejected";
  classification_score: number;
  regret_score: number;
  status: "active" | "cancelled" | "paused" | "uncertain";
  // Provenance — lets us debug why a row landed the way it did without
  // re-running the engine.
  source: {
    catalog_key: string | null;       // hit in lib/data/merchant-catalog.json
    matched_alias: string | null;
    matched_domain: string | null;
    biller: string | null;             // apple|google_play|paypal|stripe|square|null
    raw_descriptor: string;
    plaid_merchant_name: string | null;
    ai_source: string | null;          // "cache"|"haiku"|"fallback"|null
  };
};

export type ScanSnapshot = {
  scan_run_id: string;
  user_id: string;
  as_of_date: string; // ISO
  rows: SnapshotRow[];
  // Aggregates denormalized for cheap reads. Equal to the relevant sum
  // over rows; the integrity test asserts this.
  detected_count: number;        // rows where classification = 'confirmed'
  monthly_upkeep_cents: number;  // sum of monthly_equivalent_cents over confirmed
};
