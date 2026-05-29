import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/learning/finding-resolve
//
// Body: {
//   finding_id: string,           // 'leak:<id>' | 'shock:<id>' | 'concentration:dashboard'
//   finding_kind: string,         // Finding.kind from lib/selectors/findings.ts
//   action: 'look_into_it' | 'looks_fine',
//   subscription_ids?: string[],  // snapshot of refs at resolution
// }
//
// Inserts a row into feedback_finding_resolve (one resolution per
// (user, finding_id) — second submission collapses to a no-op).
// This is the canonical record of finding-level resolution; the
// dashboard selector reads from this table to filter resolved
// findings out of the noticed feed.
//
// Does NOT write to user_overrides. Per-subscription decisions
// continue to flow through the existing /api/feedback path —
// the client calls both endpoints when a finding has contributing
// subs. The two writes are independent: the finding can be
// resolved without changing per-sub state, and vice versa.

export const runtime = "nodejs";
export const maxDuration = 5;

function s(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: {
    finding_id?: unknown;
    finding_kind?: unknown;
    action?: unknown;
    subscription_ids?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const finding_id = s(body.finding_id, 128);
  const finding_kind = s(body.finding_kind, 64);
  const action = s(body.action, 32);
  if (!finding_id || !finding_kind || !action) {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }
  if (action !== "look_into_it" && action !== "looks_fine") {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }

  // Sanitize subscription_ids — array of trimmed non-empty strings,
  // each ≤ 64 chars. Defensive cap at 32 ids per resolution.
  const rawIds = Array.isArray(body.subscription_ids) ? body.subscription_ids : [];
  const subscription_ids: string[] = [];
  for (const v of rawIds.slice(0, 32)) {
    const id = s(v, 64);
    if (id) subscription_ids.push(id);
  }

  try {
    const { error } = await supabaseAdmin
      .from("feedback_finding_resolve")
      .insert({
        clerk_user_id: user.id,
        finding_id,
        finding_kind,
        action,
        subscription_ids,
      });
    if (error) {
      // Unique violation = already resolved. Idempotent — return ok.
      const code = (error as { code?: string | number }).code;
      if (code === "23505" || code === 23505) {
        return NextResponse.json({ ok: true, already_resolved: true });
      }
      return NextResponse.json(
        { error: "db_insert_failed", details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error: "db_insert_threw",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
