import { Redis } from "@upstash/redis";
import type { ScanEvent } from "@/lib/types/scan";

// Upstash Redis client. Reads UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN from env. We keep the client null-safe at
// import time so a missing env var doesn't break the build of unrelated
// routes — callers handle the null path gracefully.

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis: Redis | null =
  url && token ? new Redis({ url, token }) : null;

if (!redis) {
  // eslint-disable-next-line no-console
  console.warn(
    "[cache] Upstash env vars missing — cache disabled, scans will run uncached"
  );
}

// ---------- typed key helpers ----------
//
// All keys are funneled through a single module so we can change the
// versioning scheme in one place when the cache shape evolves.

// All Redis keys live here so versioning + invalidation are centralized.
//
// Removed: `userScan` — the old per-user cached scan blob. Replaced by
// the immutable `scan_snapshots` table read directly from Postgres.
export const cacheKey = {
  rescanLock: (userId: string) => `lock:scan:${userId}`,
  rescanCooldown: (userId: string) => `rescan:cooldown:${userId}`,
  aiMerchant: (descriptorKey: string) => `ai:merchant:v1:${descriptorKey}`,
  scanEvents: (scanId: string) => `scan:${scanId}:events`,
  webhookKey: (signingKeyId: string) => `plaid:wh:key:${signingKeyId}`,
  // ---- Probabilistic feedback system (migration 014) ----
  merchantPrior: (merchantKey: string) => `score:merchant:v1:${merchantKey}`,
  merchantDictionary: () => `score:dictionary:v1`,
  userOverrides: (userId: string) => `score:overrides:v1:${userId}`,
  activeModel: () => `score:model:active:v1`,
  modelRoster: () => `score:model:roster:v1`,
  feedbackRateLimit: (userId: string) => `rl:feedback:${userId}`,
  // Per-user limit on /api/plaid/scan — distinct from rescanCooldown
  // because /scan is the auto-on-connect path while /rescan is the
  // manual button. Same Redis pattern (SETNX), different key.
  scanRateLimit: (userId: string) => `rl:scan:${userId}`,
  // Per-IP, counter-based limit on the public /api/waitlist endpoint.
  // Window-keyed so we get sliding-ish behavior without a Lua script.
  waitlistIpLimit: (ip: string) => `rl:waitlist:${ip}`,
} as const;

// ---------- get / set / del ----------

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const v = await redis.get<T>(key);
    return (v ?? null) as T | null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cache] get failed", key, e);
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value as unknown as string, { ex: ttlSeconds });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cache] set failed", key, e);
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cache] del failed", key, e);
  }
}

// SETNX-style lock. Returns true if we acquired the lock, false if
// another caller already holds it. Used to enforce the re-scan cooldown
// and to serialize webhook-vs-manual races.
export async function tryAcquireLock(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  if (!redis) return true; // degrade open — cache unavailable, allow the work
  try {
    const res = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
    return res === "OK";
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cache] lock failed", key, e);
    return true;
  }
}

// Counter-based rate limit. Returns { ok: true } if the caller is under
// the limit, { ok: false, retry_after_seconds } if they're over.
//
// Uses INCR + EXPIRE. The first request in a window sets EXPIRE so the
// counter auto-resets. Cheap (one round-trip), no Lua, works fine on
// Upstash REST. Not a true sliding window — a burst can use the full
// allowance in the last second of one window plus the first second of
// the next — but for our spam-prevention use case this is fine.
//
// Use cases:
//   - /api/waitlist by IP    (block scripted floods of public form)
//   - /api/plaid/scan by user (block accidental loops that hit Plaid)
//
// Degrades open if Redis is down (same philosophy as tryAcquireLock):
// we'd rather serve a real user than reject everything during an
// Upstash outage.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ ok: boolean; remaining: number; retry_after_seconds: number }> {
  if (!redis) return { ok: true, remaining: limit, retry_after_seconds: 0 };
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // First hit in this window — set the TTL.
      await redis.expire(key, windowSeconds);
    }
    if (count > limit) {
      const ttl = await redis.ttl(key);
      return {
        ok: false,
        remaining: 0,
        retry_after_seconds: Math.max(1, ttl),
      };
    }
    return {
      ok: true,
      remaining: Math.max(0, limit - count),
      retry_after_seconds: 0,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cache] rate-limit check failed", key, e);
    return { ok: true, remaining: limit, retry_after_seconds: 0 };
  }
}

// ---------- SSE event stream (Redis Stream) ----------
//
// The worker writes scan events to a Redis Stream keyed by scan_id; the
// SSE route XREAD's from it and forwards to the browser. Redis Streams
// give us automatic backpressure + a replay window for reconnects, which
// pub/sub does not.

export async function publishScanEvent(
  scanId: string,
  event: ScanEvent
): Promise<void> {
  if (!redis) return;
  try {
    await redis.xadd(cacheKey.scanEvents(scanId), "*", {
      payload: JSON.stringify(event),
    });
    // Cap stream length so a stuck scan can't fill Redis indefinitely.
    await redis.xtrim(cacheKey.scanEvents(scanId), {
      strategy: "MAXLEN",
      threshold: 500,
      exactness: "~",
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cache] publish failed", scanId, e);
  }
}

export type StreamCursor = string; // last seen stream id, "0" = from start

export async function readScanEvents(
  scanId: string,
  cursor: StreamCursor,
  blockMs = 5_000
): Promise<{ cursor: StreamCursor; events: ScanEvent[] }> {
  if (!redis) return { cursor, events: [] };
  try {
    // Upstash signature: xread(key, id, { blockMS, count }). Returns
    // null if no entries arrived within blockMS, otherwise an object
    // keyed by stream name with an object of id → fields.
    const res = (await redis.xread(
      cacheKey.scanEvents(scanId),
      cursor,
      { blockMS: blockMs, count: 50 }
    )) as unknown as
      | Record<string, Record<string, Record<string, string>>>
      | null;

    if (!res) return { cursor, events: [] };
    const entries = res[cacheKey.scanEvents(scanId)] ?? {};
    let nextCursor = cursor;
    const events: ScanEvent[] = [];
    for (const id of Object.keys(entries)) {
      nextCursor = id;
      const data = entries[id];
      try {
        events.push(JSON.parse(data.payload) as ScanEvent);
      } catch {
        // skip malformed event, advance cursor
      }
    }
    return { cursor: nextCursor, events };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[cache] xread failed", scanId, e);
    return { cursor, events: [] };
  }
}
