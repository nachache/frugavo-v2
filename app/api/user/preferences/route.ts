import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import {
  getUserPreferences,
  patchUserPreferences,
} from "@/lib/user-preferences";

// GET /api/user/preferences        → returns the user's prefs blob
// POST /api/user/preferences        → merges body into the blob
//
// Tiny endpoint that backs the dashboard's tab+sort persistence and
// any future per-user UI state.

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const prefs = await getUserPreferences(user.id);
  return NextResponse.json({ prefs });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  // Reject huge payloads — UI state should be tiny.
  if (JSON.stringify(body).length > 4096) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const prefs = await patchUserPreferences(user.id, body);
  return NextResponse.json({ ok: true, prefs });
}
