import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/cancellations
//
// Records a cancellation attempt. The user has either clicked through
// to the provider's cancel page, copied the email template, or
// self-reported. We mark `outcome=pending` until the next-bill watcher
// confirms (separately wired once /transactions/sync lands).
//
// Body: { subscription_id: string, method: 'assist'|'manual', notes?: string }

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: {
    subscription_id?: string;
    method?: string;
    notes?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (!body.subscription_id || !body.method) {
    return NextResponse.json(
      { error: "subscription_id and method are required" },
      { status: 400 }
    );
  }

  // Verify the subscription belongs to this user before recording the
  // cancellation. Otherwise any signed-in user could mark anyone else's
  // sub as cancelled.
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id")
    .eq("id", body.subscription_id)
    .maybeSingle();

  if (!sub || sub.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: row, error: insertErr } = await supabaseAdmin
    .from("cancellations")
    .insert({
      subscription_id: body.subscription_id,
      user_id: user.id,
      method: body.method,
      outcome: "pending",
      notes: body.notes ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    // eslint-disable-next-line no-console
    console.error("[cancellations] insert failed", insertErr);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  // Flip the subscription's user_decision so the UI can dim the row
  // optimistically. The status stays 'active' until the watcher
  // confirms the next bill didn't fire.
  await supabaseAdmin
    .from("subscriptions")
    .update({
      user_decision: "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.subscription_id);

  return NextResponse.json({
    ok: true,
    cancellation_id: row.id,
  });
}
