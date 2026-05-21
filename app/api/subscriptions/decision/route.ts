import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/subscriptions/decision
//
// Sets the user_decision on a subscription. Used by the "Keep" button
// and by the cancellation flow's optimistic write. Decisions:
//   - 'keep'   — user explicitly opted in. Hides from candidate lists.
//   - 'cancel' — user said "I cancelled it." Pending watcher confirm.
//   - 'unsure' — watcher saw a charge after cancel. Needs retry.
//   -  null    — clears the decision (reset to default).

export const runtime = "nodejs";
export const maxDuration = 10;

const VALID_DECISIONS = ["keep", "cancel", "unsure", null] as const;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: { subscription_id?: string; decision?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (!body.subscription_id) {
    return NextResponse.json(
      { error: "subscription_id required" },
      { status: 400 }
    );
  }
  if (!(VALID_DECISIONS as readonly (string | null)[]).includes(body.decision ?? null)) {
    return NextResponse.json(
      { error: "decision must be one of keep | cancel | unsure | null" },
      { status: 400 }
    );
  }

  // Verify ownership before touching the row.
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("id", body.subscription_id)
    .maybeSingle();

  if (!sub || sub.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: updErr } = await supabaseAdmin
    .from("subscriptions")
    .update({
      user_decision: body.decision ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.subscription_id);

  if (updErr) {
    // eslint-disable-next-line no-console
    console.error("[decision] update failed", updErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
