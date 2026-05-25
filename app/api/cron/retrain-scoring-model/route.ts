import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fitLogistic, type FitInput } from "@/lib/logistic-fit";

// POST /api/cron/retrain-scoring-model
//
// Weekly retraining job for the logistic layer of the probabilistic
// scorer. Reads positive/negative feedback events, fits coefficients,
// writes a new model_versions row with is_active=false. An operator
// promotes the candidate via /api/admin/promote-model after reviewing
// the loss + sample count on /app/admin/models.
//
// Auth: shared-secret bearer. Reads CRON_SECRET (preferred) with
// FRUGAVO_CRON_SECRET as a legacy alias for back-compat. Pass via the
// standard `Authorization: Bearer <secret>` header, matching every
// other /api/cron/* route. Netlify scheduled functions don't have
// Clerk context, so we can't rely on currentUser() here.
//
// Determinism: same feedback_events set + same fitter config + same
// scanner_version filter → same coefficients. Snapshots saved on the
// model_versions row capture intermediate states for replay.

export const runtime = "nodejs";
export const maxDuration = 60;

const CATEGORY_FEATURES = [
  "category_software",
  "category_streaming",
  "category_news",
  "category_fitness",
  "category_food_delivery",
  "category_cloud_storage",
  "category_gaming",
  "category_telecom",
  "category_utilities",
];

const FEATURE_NAMES = [
  "intercept",
  "regularity",
  "amount_consistency",
  "log_occurrences",
  "in_dictionary",
  ...CATEGORY_FEATURES,
];

type FeedbackEventRow = {
  outcome: "positive" | "negative" | "edit";
  features: {
    regularity?: number;
    amount_consistency?: number;
    occurrences?: number;
    in_dictionary?: boolean;
    category?: string;
  };
};

function buildFeatureVector(f: FeedbackEventRow["features"]): number[] {
  const cat = (f.category ?? "").toLowerCase();
  const row: number[] = [
    1, // intercept
    typeof f.regularity === "number" ? f.regularity : 0,
    typeof f.amount_consistency === "number" ? f.amount_consistency : 0,
    Math.log1p(Math.max(0, f.occurrences ?? 0)),
    f.in_dictionary === true ? 1 : 0,
  ];
  for (const name of CATEGORY_FEATURES) {
    const target = name.replace("category_", "");
    row.push(cat === target ? 1 : 0);
  }
  return row;
}

export async function POST(req: NextRequest) {
  // Auth — prefer CRON_SECRET (the canonical name), fall back to
  // FRUGAVO_CRON_SECRET for back-compat with older Netlify env configs.
  const expected =
    process.env.CRON_SECRET ?? process.env.FRUGAVO_CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const got =
    auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : // Legacy header for callers that haven't migrated yet.
        req.headers.get("x-cron-secret") ?? "";
  if (!expected || expected !== got) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Load every feedback event that has a useful outcome. We drop
  // "edit" events because they confirm the merchant IS a sub but
  // their feature snapshot reflects pre-edit values — using them
  // would teach the model "if user edited, this is a subscription"
  // which is trivially true and unhelpful.
  const { data: rows, error } = await supabaseAdmin
    .from("feedback_events")
    .select("outcome, features")
    .in("outcome", ["positive", "negative"])
    .limit(50000);
  if (error) {
    return NextResponse.json(
      { error: "feedback_read_failed", details: error.message },
      { status: 500 }
    );
  }
  const events = (rows ?? []) as FeedbackEventRow[];
  if (events.length < 20) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "insufficient_samples",
      samples: events.length,
    });
  }

  // Build X, y.
  const X: number[][] = [];
  const y: number[] = [];
  for (const e of events) {
    X.push(buildFeatureVector(e.features ?? {}));
    y.push(e.outcome === "positive" ? 1 : 0);
  }

  // Fit.
  const fit = fitLogistic(
    { feature_names: FEATURE_NAMES, X, y },
    { iterations: 500, learning_rate: 0.08, l2: 0.001, snapshot_every: 100 }
  );

  // Compose a model_versions row. Coefficients are stored under their
  // semantic names so the scorer can read them by key, not by
  // positional index — that way adding new features doesn't reorder
  // existing models.
  const coeffMap: Record<string, number> = {
    intercept: fit.intercept,
  };
  fit.feature_names.slice(1).forEach((name, i) => {
    coeffMap[name] = fit.coefficients[i];
  });

  const versionString = `auto-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("model_versions")
    .insert({
      version_string: versionString,
      coefficients: coeffMap,
      calibration: fit.calibration,
      training_samples: fit.training_samples,
      is_active: false,
    })
    .select("id, version_string, created_at")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json(
      { error: "model_insert_failed", details: insErr?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    model_version_id: inserted.id,
    version_string: inserted.version_string,
    training_samples: fit.training_samples,
    final_loss: fit.final_loss,
    iterations_run: fit.iterations_run,
    coefficients: coeffMap,
    calibration: fit.calibration,
    positives: y.filter((v) => v === 1).length,
    negatives: y.filter((v) => v === 0).length,
  });
}
