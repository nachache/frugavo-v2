import { describe, expect, it } from "vitest";
import {
  annualCents,
  cancelCandidates,
  candidatesAnnualSavingsCents,
  categoryBreakdown,
  monthlyEquivalentCents,
  totalMonthlyCents,
  trailingTwelveMonths,
  type SubLike,
} from "@/lib/subscription-math";

// Pure-function tests for the dashboard math layer. These don't need
// Plaid, Redis, or Postgres — they validate the math that drives the
// hero card, category donut, 12-month chart, and cancel candidates.

const sub = (overrides: Partial<SubLike> = {}): SubLike => ({
  id: overrides.id ?? "id_" + Math.random(),
  merchant_name: "Netflix",
  amount_cents: 2299,
  currency: "USD",
  frequency: "monthly",
  last_charged_at: "2026-04-01",
  next_expected_charge_at: "2026-05-01",
  status: "active",
  ...overrides,
});

describe("monthlyEquivalentCents", () => {
  it("monthly → same amount", () => {
    expect(monthlyEquivalentCents(2299, "monthly")).toBe(2299);
  });

  it("annually → 1/12th", () => {
    expect(monthlyEquivalentCents(14900, "annually")).toBe(1242);
  });

  it("weekly → amount * 52/12", () => {
    expect(monthlyEquivalentCents(1000, "weekly")).toBe(4333);
  });

  it("biweekly → amount * 26/12", () => {
    expect(monthlyEquivalentCents(1000, "biweekly")).toBe(2167);
  });

  it("semi_monthly → amount * 2", () => {
    expect(monthlyEquivalentCents(1000, "semi_monthly")).toBe(2000);
  });

  it("unknown → 0 (conservative — never invent a charge)", () => {
    expect(monthlyEquivalentCents(1000, "unknown")).toBe(0);
  });
});

describe("annualCents", () => {
  it("is 12 × monthly equivalent", () => {
    expect(annualCents(2299, "monthly")).toBe(27588);
    expect(annualCents(14900, "annually")).toBe(14904);
  });
});

describe("totalMonthlyCents", () => {
  it("sums only active subscriptions", () => {
    const subs = [
      sub({ amount_cents: 1000, frequency: "monthly", status: "active" }),
      sub({ amount_cents: 2000, frequency: "monthly", status: "cancelled" }),
      sub({ amount_cents: 12_000, frequency: "annually", status: "active" }),
    ];
    expect(totalMonthlyCents(subs)).toBe(1000 + 1000);
  });

  it("returns 0 for an empty list", () => {
    expect(totalMonthlyCents([])).toBe(0);
  });
});

describe("categoryBreakdown", () => {
  it("groups + sorts categories by monthly spend desc", () => {
    const subs = [
      sub({ amount_cents: 2299, category: "streaming" }),
      sub({ amount_cents: 5999, category: "software" }),
      sub({ amount_cents: 1199, category: "streaming" }),
    ];
    const out = categoryBreakdown(subs);
    expect(out[0].category).toBe("software");
    expect(out[0].monthlyCents).toBe(5999);
    expect(out[1].category).toBe("streaming");
    expect(out[1].monthlyCents).toBe(2299 + 1199);
  });

  it("treats unknown category as 'other'", () => {
    const subs = [sub({ category: null }), sub({ category: "fake" })];
    const out = categoryBreakdown(subs);
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe("other");
    expect(out[0].count).toBe(2);
  });
});

describe("trailingTwelveMonths", () => {
  it("returns 12 buckets oldest → newest", () => {
    const buckets = trailingTwelveMonths([], [], new Date("2026-05-15"));
    expect(buckets).toHaveLength(12);
    expect(buckets[0].yearMonth).toBe("2025-06");
    expect(buckets[11].yearMonth).toBe("2026-05");
  });

  it("prefers real charge history when given", () => {
    const charges = [
      { amount_cents: 1000, charged_at: "2026-05-10" },
      { amount_cents: 2000, charged_at: "2026-05-20" },
      { amount_cents: 3000, charged_at: "2026-04-15" },
    ];
    const buckets = trailingTwelveMonths([], charges, new Date("2026-05-31"));
    const may = buckets.find((b) => b.yearMonth === "2026-05");
    const apr = buckets.find((b) => b.yearMonth === "2026-04");
    expect(may?.totalCents).toBe(3000);
    expect(apr?.totalCents).toBe(3000);
  });

  it("projects from current state when no charges given", () => {
    const subs = [sub({ amount_cents: 2299, frequency: "monthly" })];
    const buckets = trailingTwelveMonths(subs, [], new Date("2026-05-15"));
    for (const b of buckets) {
      expect(b.totalCents).toBe(2299);
    }
  });
});

describe("cancelCandidates", () => {
  it("always surfaces the biggest active sub first", () => {
    const subs = [
      sub({ id: "small", amount_cents: 500 }),
      sub({ id: "big", amount_cents: 9999 }),
      sub({ id: "mid", amount_cents: 2299 }),
    ];
    const out = cancelCandidates(subs);
    expect(out[0].reason).toBe("biggest");
    expect(out[0].sub.id).toBe("big");
  });

  it("flags 'forgotten' for high regret_score (>=60)", () => {
    const subs = [
      sub({ id: "big", amount_cents: 9999, regret_score: 5 }),
      sub({ id: "forgotten", amount_cents: 1500, regret_score: 80 }),
    ];
    const out = cancelCandidates(subs);
    expect(out.find((c) => c.reason === "forgotten")?.sub.id).toBe(
      "forgotten"
    );
  });

  it("dedupes — same sub never appears twice", () => {
    const subs = [
      sub({ id: "one", amount_cents: 9999, regret_score: 90 }),
    ];
    const out = cancelCandidates(subs);
    const ids = out.map((c) => c.sub.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns ALL actionable candidates, not capped at 3", () => {
    const subs = Array.from({ length: 10 }, (_, i) =>
      sub({
        id: `s${i}`,
        amount_cents: 1000 * (i + 1),
        regret_score: 90,
        last_charged_at: "2024-01-01", // also silent
      })
    );
    const out = cancelCandidates(subs);
    // 10 active subs, all flagged — every one becomes a candidate.
    expect(out.length).toBe(10);
  });

  it("filters out user_decision='keep' (user opted out)", () => {
    const subs = [
      sub({ id: "kept", amount_cents: 9999, user_decision: "keep" }),
      sub({ id: "active", amount_cents: 5000 }),
    ];
    const out = cancelCandidates(subs);
    expect(out.find((c) => c.sub.id === "kept")).toBeUndefined();
    expect(out.find((c) => c.sub.id === "active")).toBeDefined();
  });

  it("filters out user_decision='cancel' (already pending)", () => {
    const subs = [
      sub({ id: "pending", amount_cents: 9999, user_decision: "cancel" }),
      sub({ id: "active", amount_cents: 5000 }),
    ];
    const out = cancelCandidates(subs);
    expect(out.find((c) => c.sub.id === "pending")).toBeUndefined();
    expect(out.find((c) => c.sub.id === "active")).toBeDefined();
  });

  it("biggest always sorts first in the returned list", () => {
    const subs = [
      sub({ id: "forgotten", amount_cents: 2000, regret_score: 90 }),
      sub({ id: "biggest", amount_cents: 9999 }),
      sub({
        id: "silent",
        amount_cents: 1500,
        last_charged_at: "2024-01-01",
      }),
    ];
    const out = cancelCandidates(subs);
    expect(out[0].reason).toBe("biggest");
    expect(out[0].sub.id).toBe("biggest");
  });

  it("returns nothing when there are no active subs", () => {
    expect(cancelCandidates([])).toEqual([]);
    const cancelled = [sub({ status: "cancelled" })];
    expect(cancelCandidates(cancelled)).toEqual([]);
  });
});

describe("candidatesAnnualSavingsCents", () => {
  it("sums annual equivalents across the candidates list", () => {
    const subs = [
      sub({ id: "a", amount_cents: 1000, frequency: "monthly", regret_score: 90 }),
      sub({ id: "b", amount_cents: 5000, frequency: "monthly" }),
    ];
    const candidates = cancelCandidates(subs);
    const total = candidatesAnnualSavingsCents(candidates);
    // 1000 + 5000 monthly → 6000 monthly → 72000 annual.
    expect(total).toBe(72_000);
  });

  it("returns 0 for an empty candidates list", () => {
    expect(candidatesAnnualSavingsCents([])).toBe(0);
  });
});
