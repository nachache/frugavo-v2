import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import {
  loadPreferences,
  savePreferences,
} from "@/lib/notifications/preferences";

// GET /api/user/notification-preferences
// POST same path
//
// Authenticated. Returns the user's merged preferences (defaults +
// stored overrides). POST body is a partial patch — only fields
// present are touched.

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const prefs = await loadPreferences(user.id);
  return NextResponse.json({ ok: true, prefs });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const patch: Parameters<typeof savePreferences>[1] = {};
  if (typeof body.email_enabled === "boolean")
    patch.email_enabled = body.email_enabled;
  if (typeof body.digest_enabled === "boolean")
    patch.digest_enabled = body.digest_enabled;
  if (typeof body.urgent_immediate_enabled === "boolean")
    patch.urgent_immediate_enabled = body.urgent_immediate_enabled;
  if (typeof body.quiet_hours_local === "string" || body.quiet_hours_local === null)
    patch.quiet_hours_local = body.quiet_hours_local as string | null;
  if (body.enabled_types && typeof body.enabled_types === "object") {
    const incoming = body.enabled_types as Record<string, unknown>;
    const sanitized: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (typeof v === "boolean") sanitized[k] = v;
    }
    patch.enabled_types = sanitized;
  }
  // Allow re-subscribing via UI: setting global_unsubscribed_at to null.
  if (body.global_unsubscribed_at === null)
    patch.global_unsubscribed_at = null;

  const prefs = await savePreferences(user.id, patch);
  return NextResponse.json({ ok: true, prefs });
}
