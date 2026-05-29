import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/learning/event
//
// Body: { name, properties?, path?, session_id }
//
// Inserts a row into events. Auth via Clerk — anonymous events are
// not allowed during beta. The client sends fire-and-forget, so we
// keep this lightweight and never block on errors. Returns 204 on
// success; failures log server-side and still return 204 so the
// client's keepalive request resolves cleanly.

export const runtime = "nodejs";
export const maxDuration = 5;

// Defense in depth — properties is jsonb on the DB but we still cap
// what we accept so a malformed client can't bloat the table.
const MAX_PROPERTIES_KEYS = 32;
const MAX_VALUE_LEN = 512;

function sanitizeProperties(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_PROPERTIES_KEYS) break;
    if (typeof k !== "string" || k.length > 64) continue;
    if (
      v === null ||
      typeof v === "boolean" ||
      typeof v === "number"
    ) {
      out[k] = v;
    } else if (typeof v === "string") {
      out[k] = v.slice(0, MAX_VALUE_LEN);
    } else {
      // Drop objects, arrays, etc. We don't accept nested structures
      // — the schema-on-read jsonb already lets us evolve later.
      continue;
    }
    count += 1;
  }
  return out;
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  if (!supabaseAdmin) return new NextResponse(null, { status: 204 });

  let body: {
    name?: unknown;
    properties?: unknown;
    path?: unknown;
    session_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const name =
    typeof body.name === "string" && body.name.length > 0 && body.name.length <= 96
      ? body.name
      : null;
  const session_id =
    typeof body.session_id === "string" && body.session_id.length <= 64
      ? body.session_id
      : null;
  const path =
    typeof body.path === "string" && body.path.length <= 256
      ? body.path
      : null;
  if (!name || !session_id) {
    // Malformed — swallow silently so a flaky client doesn't fill
    // server logs with useless 4xx noise.
    return new NextResponse(null, { status: 204 });
  }

  const properties = sanitizeProperties(body.properties);

  try {
    await supabaseAdmin.from("events").insert({
      clerk_user_id: user.id,
      session_id,
      name,
      properties,
      path,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      "[learning/event] insert failed (non-fatal)",
      name,
      e instanceof Error ? e.message : String(e)
    );
  }

  return new NextResponse(null, { status: 204 });
}
