import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/doubt/:id/resolve
//
// Body: { resolution: 'confirmed' | 'not_sub' | 'shared' | 'work' |
//                     'family' | 'temporary' | 'one_off' }
//
// Marks the doubt as resolved + writes a corresponding user_overrides
// row when the resolution implies one. Logs the 'answered' event to
// doubt_prompts_log for telemetry tuning.
//
// Authorization: the doubt MUST belong to the calling user. Service
// role bypasses RLS but we double-check user_id matches.

export const runtime = "nodejs";
export const maxDuration = 5;

type Resolution =
  | "confirmed"
  | "not_sub"
  | "shared"
  | "work"
  | "family"
  | "temporary"
  | "one_off";

// Resolution → user_overrides mapping. Some chips are metadata-only
// (shared/work/family/temporary) and stay on the doubt_item without
// writing a user_overrides row. Those still feed retention via the
// "user touched it" signal but don't change engine math.
const OVERRIDE_FOR_RESOLUTION: Record<
  Resolution,
  "confirmed" | "not_recurring" | "not_subscription" | null
> = {
  confirmed: "confirmed",
  not_sub: "not_subscription",
  one_off: "not_recurring",
  shared: "confirmed", // it IS a real recurring sub, just shared
  work: "confirmed",
  family: "confirmed",
  temporary: "confirmed", // still a sub today, may not be next month
};

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

  let body: { resolution?: string; surface?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const resolution = body.resolution as Resolution | undefined;
  if (!resolution || !(resolution in OVERRIDE_FOR_RESOLUTION)) {
    return NextResponse.json(
      { error: "invalid_resolution", allowed: Object.keys(OVERRIDE_FOR_RESOLUTION) },
      { status: 400 }
    );
  }

  // Surface tracking — which UI surface answered. Defaults to
  // dashboard_module if not provided (most resolves come from there;
  // scan-chip resolves pass surface='scan_chip').
  const surface =
    body.surface === "scan_chip" ? "scan_chip" : "dashboard_module";

  // Fetch the doubt row to confirm ownership + read merchant_key.
  const { data: doubt } = await supabaseAdmin
    .from("doubt_items")
    .select("id, user_id, subscription_id, merchant_key, confidence, resolved_at")
    .eq("id", doubtId)
    .maybeSingle();

  if (!doubt || doubt.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (doubt.resolved_at) {
    // Idempotent: already answered. Don't write the override again.
    return NextResponse.json({ ok: true, already_resolved: true });
  }

  // CRITICAL: user_overrides must be keyed on the SUBSCRIPTION's
  // merchant_key (engine source_key like 'apple_t10'), not the
  // doubt's merchant_key (Claude's canonical like 'apple_icloud').
  // The dashboard filter reads overrides via the subscription row's
  // merchant_key — mismatching the two keys makes overrides
  // invisible and is the bug that has been preventing confirms
  // from updating the dashboard in real time.
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("merchant_key")
    .eq("id", doubt.subscription_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const overrideMerchantKey =
    (sub?.merchant_key as string | null) ?? doubt.merchant_key;

  const nowIso = new Date().toISOString();

  // 1. Mark doubt as resolved.
  const { error: updateErr } = await supabaseAdmin
    .from("doubt_items")
    .update({
      resolved_at: nowIso,
      resolution,
      updated_at: nowIso,
    })
    .eq("id", doubtId);
  if (updateErr) {
    // eslint-disable-next-line no-console
    console.error("[doubt-resolve] update failed", updateErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // 2. Write user_overrides if the resolution implies one. Upsert on
  //    (user_id, merchant_key) so a later resolve flips the override
  //    rather than failing on the unique index.
  const overrideType = OVERRIDE_FOR_RESOLUTION[resolution];
  if (overrideType) {
    await supabaseAdmin
      .from("user_overrides")
      .upsert(
        {
          user_id: user.id,
          subscription_id: doubt.subscription_id,
          // Engine source_key — see the lookup above. Reading +
          // writing on the same key shape is the contract the
          // dashboard filter relies on.
          merchant_key: overrideMerchantKey,
          override_type: overrideType,
          override_value: {
            resolution,
            source: "doubt_resolve",
            // Audit: stash Claude's canonical here so we can later
            // migrate to canonical-everywhere without losing the
            // provenance.
            canonical_merchant_key: doubt.merchant_key,
          },
          updated_at: nowIso,
        },
        { onConflict: "user_id,merchant_key" }
      );
  }

  // 3. Append 'answered' event to telemetry log.
  await supabaseAdmin.from("doubt_prompts_log").insert({
    user_id: user.id,
    doubt_item_id: doubtId,
    event: "answered",
    surface,
    confidence_at_event: doubt.confidence,
  });

  return NextResponse.json({ ok: true });
}
