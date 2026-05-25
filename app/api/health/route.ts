import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { redis } from "@/lib/cache";

// GET /api/health
//
// Lightweight liveness + dependency health endpoint. Designed for two
// audiences:
//
//   1. Uptime monitors (UptimeRobot, BetterUptime, Pingdom). They want a
//      fast 200 OK from one stable URL. We keep this dead simple — no
//      DB write, no heavy work — and return 200 when Frugavo's edge is
//      reachable and the critical services are reachable.
//
//   2. Humans debugging "is X down?" — the JSON body breaks out per-
//      service status so an oncall can curl this and see what failed.
//
// Status codes:
//   200 OK              — everything reachable
//   503 Service Unavail — one or more critical services are down
//
// We do NOT auth-check this route. Uptime monitors won't carry cookies.
// The body is non-sensitive (boolean per service + commit sha if set).

export const runtime = "nodejs";

type ServiceCheck = "ok" | "down" | "skipped";

type HealthBody = {
  ok: boolean;
  ts: string;
  uptime_seconds: number;
  commit: string | null;
  services: {
    supabase: ServiceCheck;
    redis: ServiceCheck;
  };
};

const startedAt = Date.now();

async function pingSupabase(): Promise<ServiceCheck> {
  if (!supabaseAdmin) return "skipped";
  try {
    // Cheapest possible round-trip: HEAD-ish select with a hard limit.
    // We don't care about the row, just that Postgres + PostgREST
    // answer in a reasonable time.
    const { error } = await supabaseAdmin
      .from("app_users")
      .select("id", { count: "exact", head: true })
      .limit(1);
    return error ? "down" : "ok";
  } catch {
    return "down";
  }
}

async function pingRedis(): Promise<ServiceCheck> {
  if (!redis) return "skipped";
  try {
    const pong = await redis.ping();
    return pong === "PONG" ? "ok" : "down";
  } catch {
    return "down";
  }
}

export async function GET() {
  const [supabase, redisStatus] = await Promise.all([
    pingSupabase(),
    pingRedis(),
  ]);

  const allUp = supabase !== "down" && redisStatus !== "down";

  const body: HealthBody = {
    ok: allUp,
    ts: new Date().toISOString(),
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
    // Netlify sets COMMIT_REF on every deploy. Lets the dashboard
    // tell "is the latest deploy live?" at a glance.
    commit: process.env.COMMIT_REF ?? null,
    services: {
      supabase,
      redis: redisStatus,
    },
  };

  return NextResponse.json(body, { status: allUp ? 200 : 503 });
}
