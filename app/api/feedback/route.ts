import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  scoreCandidate,
  featuresFromCharges,
  outcomeFromOverride,
  type CandidateFeatures,
  type UserOverride,
} from "@/lib/scoring";
import {
  getMerchantPrior,
  incrementMerchantPrior,
  getMerchantDictionary,
} from "@/lib/merchants-store";
import {
  writeOverride,
  invalidateUserOverridesCache,
} from "@/lib/user-overrides";
import { pickModelForUser } from "@/lib/model-store";
import { tryAcquireLock, cacheKey } from "@/lib/cache";
import { SCANNER_VERSION } from "@/lib/scanner-version";

// POST /api/feedback
//
// The single endpoint a user hits when correcting a subscription
// classification. It does five things atomically (Postgres
// transaction-ish — supabase-js doesn't expose BEGIN; we sequence
// the writes carefully and use idempotent upserts so partial
// failures stay recoverable):
//
//   1. Write user_overrides for that (user, merchant). Upsert.
//   2. Increment merchant alpha or beta based on the override type.
//   3. Re-score the affected subscription(s) and update the row.
//   4. Append a row to feedback_events (immutable audit + retraining).
//   5. Invalidate Redis caches for the user + merchant prior.
//
// Rate limiting via a per-user Redis lock (10s) to prevent click-spam.
//
// Body: {
//   subscription_id: uuid,
//   override_type: "confirmed" | "not_recurring" | "not_subscription"
//                  | "wrong_amount" | "wrong_cadence" | "cancelled",
//   override_value?: object   // e.g. { amount_cents: 1599 }
// }

export const runtime = "nodejs";
export const maxDuration = 10;

type Body = {
  subscription_id?: string;
  override_type?: UserOverride["override_type"];
  override_value?: Record<string, unknown>;
};

type SubRow = {
  id: string;
  user_id: string;
  merchant_key: string | null;
  merchant_name: string | null;
  category: string;
  amount_cents: number;
  currency: string;
  frequency: string;
  status: string;
};

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // ---- Rate limit ----
  const lockOk = await tryAcquireLock(
    cacheKey.feedbackRateLimit(user.id),
    2 // 2s lock window — humans clicking buttons
  );
  if (!lockOk) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: 2 },
      { status: 429 }
    );
  }

  // ---- Parse + validate ----
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { subscription_id, override_type, override_value } = body;
  if (!subscription_id || !/^[0-9a-f-]{36}$/i.test(subscription_id)) {
    return NextResponse.json(
      { error: "subscription_id_invalid" },
      { status: 400 }
    );
  }
  const VALID_TYPES = new Set([
    "confirmed",
    "not_recurring",
    "not_subscription",
    "wrong_amount",
    "wrong_cadence",
    "cancelled",
  ]);
  if (!override_type || !VALID_TYPES.has(override_type)) {
    return NextResponse.json(
      { error: "override_type_invalid", expected: Array.from(VALID_TYPES) },
      { status: 400 }
    );
  }

  // ---- Load the subscription (scoped to user) ----
  const { data: subData, error: subErr } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, user_id, merchant_key, merchant_name, category, amount_cents, currency, frequency, status"
    )
    .eq("id", subscription_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (subErr) {
    return NextResponse.json(
      { error: "subscription_read_failed", details: subErr.message },
      { status: 500 }
    );
  }
  if (!subData) {
    return NextResponse.json({ error: "subscription_not_found" }, { status: 404 });
  }
  const sub = subData as SubRow;
  const merchantKey = sub.merchant_key;
  if (!merchantKey) {
    return NextResponse.json(
      { error: "subscription_has_no_merchant_key" },
      { status: 400 }
    );
  }

  // ---- 1. Write user_overrides ----
  const written = await writeOverride({
    user_id: user.id,
    subscription_id: sub.id,
    merchant_key: merchantKey,
    override_type,
    override_value: override_value ?? {},
  });
  if (!written) {
    return NextResponse.json(
      { error: "override_write_failed" },
      { status: 500 }
    );
  }

  // ---- 2. Increment Beta prior ----
  // Map override type to (alpha_delta, beta_delta). "confirmed" and
  // "cancelled" both confirm the merchant IS a subscription (the user
  // just isn't using it anymore), so both increment alpha. Edits
  // (wrong_amount, wrong_cadence) also confirm — they're refining a
  // real sub. Negative labels increment beta.
  const isNegative =
    override_type === "not_recurring" || override_type === "not_subscription";
  const alphaDelta = isNegative ? 0 : 1;
  const betaDelta = isNegative ? 1 : 0;

  const newPrior = await incrementMerchantPrior({
    merchant_key: merchantKey,
    display_name: sub.merchant_name,
    category: sub.category,
    alpha_delta: alphaDelta,
    beta_delta: betaDelta,
  });

  // ---- 3. Re-score the subscription ----
  // Pull this user's accepted charges for the sub so we can recompute
  // features (regularity, amount_consistency, occurrences). The score
  // is then written back to subscriptions for the UI to read.
  const { data: chargesData } = await supabaseAdmin
    .from("subscription_charges")
    .select("posted_date, amount_cents, detector_status")
    .eq("user_id", user.id)
    .eq("subscription_id", sub.id)
    .eq("detector_status", "accepted")
    .order("posted_date", { ascending: true });

  const accepted = (chargesData ?? []) as Array<{
    posted_date: string;
    amount_cents: number;
  }>;
  const f = featuresFromCharges(accepted);

  const dictionary = await getMerchantDictionary();
  const prior = newPrior ?? (await getMerchantPrior(merchantKey));

  const features: CandidateFeatures = {
    merchant_key: merchantKey,
    regularity: f.regularity,
    amount_consistency: f.amount_consistency,
    occurrences: f.occurrences,
    category: sub.category,
    in_dictionary: dictionary.has(merchantKey),
  };

  const model = await pickModelForUser(user.id);
  const scored = scoreCandidate({
    features,
    prior: prior ?? undefined,
    override: {
      override_type,
      override_value,
    },
    coeffs: model.coefficients,
  });

  // Persist the new probability + decision on the subscription row.
  // Schema doesn't currently carry these columns; we encode them in
  // classification_signals (jsonb) so we don't need a migration to
  // ship the endpoint. A follow-up migration can promote them to
  // first-class columns.
  const newClassification =
    scored.decision === "subscription"
      ? "confirmed"
      : scored.decision === "one_off"
        ? "rejected"
        : "needs_review";

  const newStatus =
    override_type === "cancelled" ? "cancelled" : sub.status;

  await supabaseAdmin
    .from("subscriptions")
    .update({
      classification: newClassification,
      status: newStatus,
      classification_score: scored.probability,
      classification_signals: [
        `score:${scored.probability.toFixed(3)}`,
        `decision:${scored.decision}`,
        `source:${scored.source}`,
        `override:${scored.override_type ?? "none"}`,
        `prior:a${scored.prior_alpha.toFixed(1)}b${scored.prior_beta.toFixed(1)}`,
      ],
      scanner_version: SCANNER_VERSION,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  // Apply any edits the user specified (amount or cadence).
  if (override_type === "wrong_amount" && override_value?.amount_cents) {
    await supabaseAdmin
      .from("subscriptions")
      .update({ amount_cents: Number(override_value.amount_cents) })
      .eq("id", sub.id);
  }
  if (override_type === "wrong_cadence" && override_value?.frequency) {
    await supabaseAdmin
      .from("subscriptions")
      .update({ frequency: String(override_value.frequency) })
      .eq("id", sub.id);
  }

  // ---- 4. Append feedback_events for retraining ----
  const outcome = outcomeFromOverride(override_type);
  await supabaseAdmin.from("feedback_events").insert({
    user_id: user.id,
    subscription_id: sub.id,
    merchant_key: merchantKey,
    outcome,
    override_type,
    features: {
      regularity: features.regularity,
      amount_consistency: features.amount_consistency,
      occurrences: features.occurrences,
      category: features.category,
      in_dictionary: features.in_dictionary,
      prior_alpha_before: (prior?.alpha ?? 1) - alphaDelta,
      prior_beta_before: (prior?.beta ?? 1) - betaDelta,
      probability_after: scored.probability,
    },
    scanner_version: SCANNER_VERSION,
  });

  // ---- 5. Invalidate caches ----
  await invalidateUserOverridesCache(user.id);

  return NextResponse.json({
    ok: true,
    subscription_id: sub.id,
    merchant_key: merchantKey,
    new_decision: scored.decision,
    new_probability: scored.probability,
    new_classification: newClassification,
    new_status: newStatus,
    prior_after: {
      alpha: scored.prior_alpha,
      beta: scored.prior_beta,
    },
    log_odds: {
      prior: scored.prior_log_odds,
      pattern: scored.pattern_log_odds,
      combined: scored.combined_log_odds,
    },
    source: scored.source,
  });
}
