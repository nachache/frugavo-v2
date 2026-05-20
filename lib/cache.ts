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

export const cacheKey = {
  userScan: (userId: string) => `user:${userId}:scan_v1`,
  rescanLock: (userId: string) => `lock:scan:${userId}`,
  rescanCooldown: (userId: string) => `rescan:cooldown:${userId}`,
  aiMerchant: (descriptorKey: string) => `ai:merchant:v1:${descriptorKey}`,
  scanEvents: (scanId: string) => `scan:${scanId}:events`,
  webhookKey: (signingKeyId: string) => `plaid:wh:key:${signingKeyId}`,
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
