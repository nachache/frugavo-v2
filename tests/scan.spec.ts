/**
 * Scan system test suite — Vitest.
 *
 * Run with: pnpm vitest run tests/scan.spec.ts
 *
 * The tests rely on a few module mocks declared at the top of the file:
 *   - lib/plaid           → mocked PlaidApi returning fixture streams
 *   - lib/cache           → in-memory Map standing in for Upstash
 *   - lib/supabase        → an in-memory shim implementing .from(...).insert/upsert/update/select
 *   - lib/ai/normalize    → controllable mock with failOnce() helper
 *
 * For brevity those shims live alongside this file at tests/_mocks/*.ts;
 * each is small and bypassable for an integration run by setting
 * SCAN_TEST_REAL_REDIS=1.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  installMocks,
  resetMocks,
  mockHaiku,
  mockPlaid,
  collectStream,
  buildAuthedRequest,
} from "./_mocks/scan-test-harness";

import { runScanForUser } from "@/lib/scan";
import { POST as rescanRoute } from "@/app/api/scan/rescan/route";
import { POST as webhookRoute } from "@/app/api/plaid/webhook/route";

beforeEach(() => installMocks());
afterEach(() => resetMocks());

describe("scan latency budget", () => {
  it("emits first row under 2,500ms p50 with mocked Plaid + warm cache", async () => {
    mockPlaid.respondWithFixture("ten_streams_with_history");
    mockHaiku.respondInstantly(); // cached path

    const samples: number[] = [];
    for (let i = 0; i < 11; i++) {
      const t0 = Date.now();
      const stream = await collectStream("user_test", { firstRowOnly: true });
      samples.push(Date.now() - t0);
      void stream;
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)];
    expect(p50).toBeLessThan(2_500);
  });
});

describe("SSE resilience", () => {
  it("survives a single row's AI failure without dropping the stream", async () => {
    mockPlaid.respondWithFixture("ten_streams_with_history");
    mockHaiku.failOnce();

    const events = await collectStream("user_test");
    const rowCount = events.filter((e) => e.type === "row").length;

    expect(rowCount).toBe(10); // failed row still ships via fallback chain
    expect(events.some((e) => e.type === "complete")).toBe(true);
    expect(
      events.some((e) => e.type === "error" && !e.recoverable)
    ).toBe(false);
  });
});

describe("re-scan cooldown", () => {
  it("returns 429 within 30s of a previous scan", async () => {
    mockPlaid.respondWithFixture("ten_streams_with_history");

    const first = await rescanRoute(buildAuthedRequest("user_test"));
    expect(first.status).toBe(200);

    const second = await rescanRoute(buildAuthedRequest("user_test"));
    expect(second.status).toBe(429);

    // Past the cooldown, a new scan succeeds.
    vi.advanceTimersByTime(31_000);
    const third = await rescanRoute(buildAuthedRequest("user_test"));
    expect(third.status).toBe(200);
  });
});

describe("Plaid webhook signature", () => {
  it("rejects an invalid signature with 401 and does not write side effects", async () => {
    const body = JSON.stringify({
      webhook_type: "TRANSACTIONS",
      webhook_code: "RECURRING_TRANSACTIONS_UPDATE",
      item_id: "item_xyz",
      request_id: "req_1",
    });

    const res = await webhookRoute(
      new Request("http://x/webhook", {
        method: "POST",
        body,
        headers: { "plaid-verification": "header.payloadB64.sig" },
      })
    );

    expect(res.status).toBe(401);
    expect(await mockPlaid.wasItemMarkedRefresh("item_xyz")).toBe(false);
  });

  it("dedups a duplicate webhook (same request_id) and returns 200", async () => {
    const valid = mockPlaid.signValid({
      webhook_type: "TRANSACTIONS",
      webhook_code: "RECURRING_TRANSACTIONS_UPDATE",
      item_id: "item_xyz",
      request_id: "req_dup",
    });

    const r1 = await webhookRoute(valid.request);
    const r2 = await webhookRoute(valid.request);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const r2Body = (await r2.json()) as { dedup?: boolean };
    expect(r2Body.dedup).toBe(true);
  });
});

describe("multi-account fanout", () => {
  it("Promise.allSettled: one rejected item does not abort the others", async () => {
    mockPlaid.installThreeItems({ failItemId: "item_a" });

    const result = await runScanForUser("user_with_three_items", "manual");

    expect(result.failedItems).toBe(1);
    expect(result.detected).toBeGreaterThan(0);
  });
});

describe("cache hit", () => {
  it("a second scan with warm caches returns the first row in under 200ms", async () => {
    mockPlaid.respondWithFixture("ten_streams_with_history");
    mockHaiku.respondInstantly();

    // Prime caches.
    await runScanForUser("user_warm", "manual");

    const t0 = Date.now();
    const stream = await collectStream("user_warm", { firstRowOnly: true });
    const elapsed = Date.now() - t0;
    void stream;

    expect(elapsed).toBeLessThan(200);
  });
});
