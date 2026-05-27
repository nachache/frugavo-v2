import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/doubt/:id/dismiss
//
// Bumps ignored_count on the doubt. When ignored_count reaches the
// silence threshold (2 per docs/intelligence.md), sets silenced_at
// so the doubt stops surfacing in the dashboard module. Logs the
// appropriate event ('ignored' on bump, 'silenced' on threshold hit)
// to doubt_prompts_log.
//
// Unanswered prompts are themselves a behavioral signal — the
// silenced doubt won't re-fire unless the re-evaluation gate trips
// (occurrence count doubles AND amount stays material), per
// lib/doubt-detection.canReEvaluateSilencedDoubt.

export const runtime = "nodejs";
export const maxDuration = 5;

const SILENCE_THRESHOLD = 2;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const doubtId = params.id;
  if (!doubtId) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  let body: { surface?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — surface defaults to dashboard_module
  }
  const surface =
    body.surface === "scan_chip" ? "scan_chip" : "dashboard_module";

  // Read current state.
  const { data: doubt } = await supabaseAdmin
    .from("doubt_items")
    .select(
      "id, user_id, ignored_count, confidence, resolved_at, silenced_at"
    )
    .eq("id", doubtId)
    .maybeSingle();
  if (!doubt || doubt.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (doubt.resolved_at) {
    return NextResponse.json({ ok: true, already_resolved: true });
  }
  if (doubt.silenced_at) {
    return NextResponse.json({ ok: true, already_silenced: true });
  }

  const nowIso = new Date().toISOString();
  const nextCount = ((doubt.ignored_count as number | null) ?? 0) + 1;
  const shouldSilence = nextCount >= SILENCE_THRESHOLD;

  const update: Record<string, unknown> = {
    ignored_count: nextCount,
    last_shown_at: nowIso,
    updated_at: nowIso,
  };
  if (shouldSilence) update.silenced_at = nowIso;

  const { error } = await supabaseAdmin
    .from("doubt_items")
    .update(update)
    .eq("id", doubtId);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[doubt-dismiss] update failed", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // Telemetry: 'ignored' for every dismissal; 'silenced' as a separate
  // event on threshold hit so Phase E can compute silence-rate per
  // confidence bucket cleanly.
  const logRows: Array<{
    user_id: string;
    doubt_item_id: string;
    event: "ignored" | "silenced";
    surface: string | null;
    confidence_at_event: number;
  }> = [
    {
      user_id: user.id,
      doubt_item_id: doubtId,
      event: "ignored",
      surface,
      confidence_at_event: doubt.confidence as number,
    },
  ];
  if (shouldSilence) {
    logRows.push({
      user_id: user.id,
      doubt_item_id: doubtId,
      event: "silenced",
      surface: null,
      confidence_at_event: doubt.confidence as number,
    });
  }
  await supabaseAdmin.from("doubt_prompts_log").insert(logRows);

  return NextResponse.json({
    ok: true,
    ignored_count: nextCount,
    silenced: shouldSilence,
  });
}
