// Model variant store.
//
// Reads model_versions rows that are currently rolled out, picks the
// right variant for a given user via a deterministic hash, and
// returns the coefficients to the scorer.
//
// All callers go through pickModelForUser(userId). If no rolled-out
// model exists (cold start), the scorer falls back to the hardcoded
// DEFAULT_COEFFICIENTS in lib/scoring.ts.

import { supabaseAdmin } from "./supabase";
import { cacheGet, cacheSet, cacheKey } from "./cache";
import {
  DEFAULT_COEFFICIENTS,
  type LogisticCoefficients,
} from "./scoring";

const ROSTER_TTL_SECONDS = 5 * 60;

export type ModelVariant = {
  id: string;
  version_string: string;
  rollout_pct: number;
  is_active: boolean;
  coefficients: Record<string, number>;
  calibration: { a: number; b: number } | null;
};

// FNV-1a 32-bit hash. Deterministic, cheap, distribution is uniform
// enough for bucketing purposes. Cryptographic strength isn't needed.
function hashUserToBucket(userId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h | 0) % 100;
}

async function loadRoster(): Promise<ModelVariant[]> {
  const cached = await cacheGet<ModelVariant[]>(cacheKey.modelRoster());
  if (cached) return cached;
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("model_versions")
    .select("id, version_string, rollout_pct, is_active, coefficients, calibration")
    .gt("rollout_pct", 0)
    .order("rollout_pct", { ascending: true });
  const roster = (data ?? []) as ModelVariant[];
  await cacheSet(cacheKey.modelRoster(), roster, ROSTER_TTL_SECONDS);
  return roster;
}

/**
 * For the calling user, return the active logistic coefficients + a
 * pointer to the model_version row that owns them.
 *
 * Selection rule: deterministic hash(user_id) % 100 picks a bucket.
 * Walk the rolled-out roster from SMALLEST rollout_pct upward (so
 * narrow canaries win over broad defaults) and return the first
 * model whose rollout_pct >= bucket+1 — i.e. that covers the bucket.
 */
export async function pickModelForUser(
  userId: string
): Promise<{
  coefficients: LogisticCoefficients;
  source: "default" | "model";
  model_version_id: string | null;
  version_string: string | null;
  bucket: number;
}> {
  const bucket = hashUserToBucket(userId);
  const roster = await loadRoster();

  // Find the narrowest rolled-out model that covers this user's bucket.
  for (const m of roster) {
    if (bucket < m.rollout_pct) {
      return {
        coefficients: coerceCoefficients(m.coefficients),
        source: "model",
        model_version_id: m.id,
        version_string: m.version_string,
        bucket,
      };
    }
  }
  return {
    coefficients: DEFAULT_COEFFICIENTS,
    source: "default",
    model_version_id: null,
    version_string: null,
    bucket,
  };
}

/**
 * Map a coefficient record (string keys) into the LogisticCoefficients
 * shape the scoring function expects. Missing keys fall back to the
 * hardcoded defaults so partially-trained models still produce a
 * valid score.
 */
function coerceCoefficients(
  raw: Record<string, number>
): LogisticCoefficients {
  return {
    intercept: pick(raw, "intercept", DEFAULT_COEFFICIENTS.intercept),
    regularity: pick(raw, "regularity", DEFAULT_COEFFICIENTS.regularity),
    amount_consistency: pick(
      raw,
      "amount_consistency",
      DEFAULT_COEFFICIENTS.amount_consistency
    ),
    log_occurrences: pick(
      raw,
      "log_occurrences",
      DEFAULT_COEFFICIENTS.log_occurrences
    ),
    in_dictionary: pick(
      raw,
      "in_dictionary",
      DEFAULT_COEFFICIENTS.in_dictionary
    ),
    category_software: pick(
      raw,
      "category_software",
      DEFAULT_COEFFICIENTS.category_software
    ),
    category_streaming: pick(
      raw,
      "category_streaming",
      DEFAULT_COEFFICIENTS.category_streaming
    ),
    category_news: pick(raw, "category_news", DEFAULT_COEFFICIENTS.category_news),
    category_fitness: pick(
      raw,
      "category_fitness",
      DEFAULT_COEFFICIENTS.category_fitness
    ),
    category_food_delivery: pick(
      raw,
      "category_food_delivery",
      DEFAULT_COEFFICIENTS.category_food_delivery
    ),
    category_cloud_storage: pick(
      raw,
      "category_cloud_storage",
      DEFAULT_COEFFICIENTS.category_cloud_storage
    ),
    category_gaming: pick(
      raw,
      "category_gaming",
      DEFAULT_COEFFICIENTS.category_gaming
    ),
    category_telecom: pick(
      raw,
      "category_telecom",
      DEFAULT_COEFFICIENTS.category_telecom
    ),
    category_utilities: pick(
      raw,
      "category_utilities",
      DEFAULT_COEFFICIENTS.category_utilities
    ),
  };
}

function pick(raw: Record<string, number>, key: string, fallback: number): number {
  const v = raw[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
