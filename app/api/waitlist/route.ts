import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/waitlist  { email: string }
// Inserts into the `waitlist` table. Treats duplicate emails as success — the
// caller shouldn't care whether the visitor signed up before; the UX is
// "you're on the list."

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { ok: false, error: "Server not configured" },
      { status: 503 }
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
