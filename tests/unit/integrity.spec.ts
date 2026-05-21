import { describe, it, expect } from "vitest";
import type { SnapshotRow, ScanSnapshot } from "@/lib/types/snapshot";

// Integrity contract: the snapshot's denormalized aggregates
// (detected_count, monthly_upkeep_cents) must equal the values
// computed by re-aggregating the rows. If they ever drift, the
// dashboard could show a count that disagrees with the list, or a
// total that disagrees with the rows.

function aggregate(rows: SnapshotRow[]): {
  detected: number;
  monthlyUpkeep: number;
} {
  const confirmed = rows.filter((r) => r.classification === "confirmed");
  return {
    detected: confirmed.length,
    monthlyUpkeep: confirmed.reduce(
      (sum, r) => sum + r.monthly_equivalent_cents,
      0
    ),
  };
}

function makeRow(over: Partial<SnapshotRow>): SnapshotRow {
  return {
    plaid_stream_id: "rec_a",
    merchant_name: "Test",
    category: "streaming",
    amount_cents: 999,
    currency: "USD",
    frequency: "monthly",
    monthly_equivalent_cents: 999,
    last_charged_at: null,
    next_expected_charge_at: null,
    classification: "confirmed",
    classification_score: 4,
    regret_score: 0,
    status: "active",
    source: {
      catalog_key: null,
      matched_alias: null,
      matched_domain: null,
      biller: null,
      raw_descriptor: "TEST",
      plaid_merchant_name: null,
      ai_source: null,
    },
    ...over,
  };
}

describe("Integrity — snapshot aggregates equal row-level sums", () => {
  it("count equals number of confirmed rows", () => {
    const rows = [
      makeRow({ plaid_stream_id: "a", monthly_equivalent_cents: 999 }),
      makeRow({ plaid_stream_id: "b", monthly_equivalent_cents: 1499 }),
      makeRow({
        plaid_stream_id: "c",
        classification: "needs_review",
        monthly_equivalent_cents: 500,
      }),
    ];
    const { detected, monthlyUpkeep } = aggregate(rows);
    expect(detected).toBe(2);
    expect(monthlyUpkeep).toBe(999 + 1499);
  });

  it("denormalized aggregates on a synthesized snapshot match the row sums", () => {
    const rows = [
      makeRow({ plaid_stream_id: "a", monthly_equivalent_cents: 1599 }),
      makeRow({ plaid_stream_id: "b", monthly_equivalent_cents: 2999 }),
      makeRow({ plaid_stream_id: "c", monthly_equivalent_cents: 999 }),
    ];
    const snapshot: ScanSnapshot = {
      scan_run_id: "scan-1",
      user_id: "user-1",
      as_of_date: "2026-05-21T00:00:00.000Z",
      rows,
      detected_count: rows.length,
      monthly_upkeep_cents: rows.reduce(
        (s, r) => s + r.monthly_equivalent_cents,
        0
      ),
    };
    const { detected, monthlyUpkeep } = aggregate(snapshot.rows);
    expect(detected).toBe(snapshot.detected_count);
    expect(monthlyUpkeep).toBe(snapshot.monthly_upkeep_cents);
  });
});
