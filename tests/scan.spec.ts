/**
 * Scan system test suite — Vitest.
 *
 * Run with: npm test
 *
 * STATE OF THIS FILE
 * ------------------
 * The integration-style tests below (latency, SSE resilience, cooldown,
 * fanout, cache hit) require a fully wired vi.mock layer for
 *   - lib/plaid (PlaidApi)
 *   - lib/cache (Upstash Redis + scan-event stream)
 *   - lib/supabase (full Postgres surface used by scan.ts)
 *   - lib/ai/normalize
 *
 * The mock harness in tests/_mocks/scan-test-harness.ts is a sketch of
 * that wiring, not the full thing. Standing it up properly requires
 * stubbing every Supabase chained-builder call (.from().upsert().select()
 * .single(), .from().update().eq(), etc.) — meaningful work that's
 * better done once we adopt a real Supabase test container.
 *
 * Until then, these cases are marked `it.todo` so they show up in the
 * runner output (documenting intent) without failing the build. The
 * pure unit tests in tests/unit/*.spec.ts run real assertions.
 */
import { describe, it } from "vitest";

describe("scan latency budget", () => {
  it.todo("emits first row under 2,500ms p50 with mocked Plaid + warm cache");
});

describe("SSE resilience", () => {
  it.todo("survives a single row's AI failure without dropping the stream");
});

describe("re-scan cooldown", () => {
  it.todo("returns 429 within 30s of a previous scan, 200 after 31s");
});

describe("Plaid webhook signature", () => {
  it.todo("rejects an invalid JWT signature with 401 and writes no side effects");
  it.todo("dedups a duplicate webhook (same request_id) and returns 200");
});

describe("multi-account fanout", () => {
  it.todo("Promise.allSettled: one rejected item does not abort the others");
});

describe("cache hit", () => {
  it.todo("a second scan with warm caches returns the first row in under 200ms");
});
