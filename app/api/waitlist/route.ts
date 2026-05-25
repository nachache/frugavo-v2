import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cacheKey, checkRateLimit } from "@/lib/cache";

// POST /api/waitlist  { email: string }
// Inserts into the `waitlist` table. Treats duplicate emails as success — the
// caller shouldn't care whether the visitor signed up before; the UX is
// "you're on the list."
//
// Rate limit: 5 signups per IP per hour. This is the only unauthenticated
// write endpoint on the site, so it's the obvious target for scripted
// floods. Five is generous for legitimate use (family on the same wifi
// signing up together) while making large-scale spam expensive.

export const runtime = "nodejs";

// Pull the caller's IP from common proxy headers. Netlify forwards via
// x-forwarded-for; the leftmost entry is the original client. If all
// headers are absent we fall back to a literal so unauthenticated callers
// without an IP still get rate-limited collectively (a single bucket is
// preferable to disabling the limit).
function callerIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { ok: false, error: "Server not configured" },
      { status: 503 }
    );
  }

  const ip = callerIp(req);
  const rl = await checkRateLimit(
    cacheKey.waitlistIpLimit(ip),
    5, // max signups per IP per window
    3600 // window = 1 hour
  );
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many signups. Try again later.",
        retry_after_seconds: rl.retry_after_seconds,
      },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return NextResponse.json(
      { ok: false, error: "Invalid email" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("waitlist")
    .insert({ email, referrer: req.headers.get("referer") ?? null })
    .select()
    .single();

  // 23505 is Postgres "unique violation" — they're already signed up.  Treat
  // as success for the UI; we don't want to expose that to the world.
  if (error && error.code !== "23505") {
    // eslint-disable-next-line no-console
    console.error("[waitlist] insert failed:", error);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
