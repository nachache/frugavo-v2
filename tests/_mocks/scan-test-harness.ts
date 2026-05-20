/**
 * Test harness for the scan system. Provides in-memory shims for the
 * external dependencies the scan touches: Plaid, Supabase, Upstash
 * Redis, Anthropic.
 *
 * This is a sketch of the surface area — wire each shim against the
 * real module via `vi.mock(...)` in your project's vitest.setup.ts.
 * Filled-in implementations are intentionally minimal so the test file
 * reads as a spec of expected behavior.
 */
import { vi } from "vitest";
import type { ScanEvent } from "@/lib/types/scan";

// ---------- mock state ----------
const state = {
  plaid: {
    streamsByItem: new Map<string, unknown[]>(),
    refreshedItems: new Set<string>(),
    failItem: null as string | null,
  },
  haiku: {
    failNext: false,
  },
  redis: new Map<string, string>(),
  webhookEvents: new Map<string, unknown>(),
  scanRunsByUser: new Map<string, string>(),
  rows: [] as ScanEvent[],
};

// ---------- public helpers ----------

export function installMocks() {
  vi.useFakeTimers();
  resetMocks();
}

export function resetMocks() {
  state.plaid.streamsByItem.clear();
  state.plaid.refreshedItems.clear();
  state.plaid.failItem = null;
  state.haiku.failNext = false;
  state.redis.clear();
  state.webhookEvents.clear();
  state.scanRunsByUser.clear();
  state.rows = [];
}

export const mockPlaid = {
  respondWithFixture(name: "ten_streams_with_history") {
    state.plaid.streamsByItem.set("item_default", buildFixture(name));
  },
  installThreeItems(opts: { failItemId: string }) {
    state.plaid.streamsByItem.set("item_a", buildFixture("ten_streams_with_history"));
    state.plaid.streamsByItem.set("item_b", buildFixture("ten_streams_with_history"));
    state.plaid.streamsByItem.set("item_c", buildFixture("ten_streams_with_history"));
    state.plaid.failItem = opts.failItemId;
  },
  async wasItemMarkedRefresh(itemId: string): Promise<boolean> {
    return state.plaid.refreshedItems.has(itemId);
  },
  signValid(body: Record<string, unknown>): { request: Request } {
    // The real signer would HMAC the raw body. The test harness sets
    // the verification header to a known-good fixture matched inside
    // the mocked verifyPlaidWebhook.
    const raw = JSON.stringify(body);
    return {
      request: new Request("http://x/webhook", {
        method: "POST",
        body: raw,
        headers: { "plaid-verification": "TEST_VALID" },
      }),
    };
  },
};

export const mockHaiku = {
  respondInstantly() {
    state.haiku.failNext = false;
  },
  failOnce() {
    state.haiku.failNext = true;
  },
};

export function buildAuthedRequest(userId: string): Request {
  return new Request("http://x/api/scan/rescan", {
    method: "POST",
    headers: { "x-test-user-id": userId },
  });
}

export async function collectStream(
  userId: string,
  opts: { firstRowOnly?: boolean } = {}
): Promise<ScanEvent[]> {
  void userId;
  const out: ScanEvent[] = [];
  // In a real test we'd open EventSource against the SSE route and
  // collect events. Here we read from the in-memory rows list the mock
  // scan engine has populated.
  for (const ev of state.rows) {
    out.push(ev);
    if (opts.firstRowOnly && ev.type === "row") break;
  }
  return out;
}

// ---------- fixture builders ----------

function buildFixture(name: "ten_streams_with_history") {
  void name;
  return Array.from({ length: 10 }, (_, i) => ({
    stream_id: `s_${i}`,
    merchant_name: ["Netflix", "Spotify", "Adobe", "NYT", "Peloton",
                    "LinkedIn", "iCloud", "Audible", "Dropbox", "HelloFresh"][i],
    description: `RAW DESC ${i} #1234`,
    average_amount: { amount: 9.99 + i, iso_currency_code: "USD" },
    frequency: "MONTHLY",
    last_date: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
    is_active: true,
  }));
}
