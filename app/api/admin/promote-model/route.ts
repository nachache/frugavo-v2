import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cacheDel, cacheKey } from "@/lib/cache";

// POST /api/admin/promote-model
//
// Operator action — sets rollout_pct on a model_version row. Lets an
// admin promote a candidate to a fraction of traffic without flipping
// a single global switch.
//
// Body: { id: uuid, rollout_pct: 0-100, is_active?: boolean }
//
// Auth: only the env-allowlisted admin user(s) can promote. Set
// FRUGAVO_ADMIN_USER_IDS to a comma-separated list of Clerk user
// ids. Anyone else gets 403.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allow = (process.env.FRUGAVO_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allow.includes(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: { id?: string; rollout_pct?: number; is_active?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const id = body.id;
  const rollout = body.rollout_pct;
  const setActive = body.is_active;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id_invalid" }, { status: 400 });
  }
  if (
    typeof rollout !== "number" ||
    rollout < 0 ||
    rollout > 100 ||
    !Number.isInteger(rollout)
  ) {
    return NextResponse.json(
      { error: "rollout_pct_must_be_integer_0_to_100" },
      { status: 400 }
    );
  }

  // If this promotion sets is_active=true and rollout=100, we
  // ALSO demote any other previously-active row to is_active=false
  // first — the partial unique index would otherwise fail the
  // upsert.
  if (setActive === true && rollout === 100) {
    await supabaseAdmin
      .from("model_versions")
      .update({ is_active: false })
      .neq("id", id);
  }

  const update: Record<string, unknown> = { rollout_pct: rollout };
  if (typeof setActive === "boolean") {
    update.is_active = setActive;
    if (setActive) update.promoted_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("model_versions")
    .update(update)
    .eq("id", id)
    .select("id, version_string, rollout_pct, is_active, promoted_at")
    .single();
  if (error) {
    return NextResponse.json(
      { error: "promote_failed", details: error.message },
      { status: 500 }
    );
  }

  // Bust the model roster cache so the next scoring read sees the new
  // rollout immediately.
  await cacheDel(cacheKey.modelRoster());
  await cacheDel(cacheKey.activeModel());

  return NextResponse.json({ ok: true, model: data });
}
