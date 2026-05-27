/**
 * npx tsx scripts/backfill-brand-verdicts.ts
 *
 * One-time backfill: seeds the global `brand_verdicts` table with the
 * 134 entries in lib/data/merchant-catalog.json. Without this, every
 * Frugavo scan would trigger a Claude call for known merchants like
 * Netflix and Spotify even though we already know they're subscription
 * brands.
 *
 * Idempotent — upserts on merchant_key, so running it twice produces
 * the same end state. Safe to re-run after catalog edits to push new
 * entries.
 *
 * Mapping logic:
 *   • subscription_likelihood derived from category:
 *     - 'always' for streaming, software, news, cloud_storage,
 *       gaming, fitness, education, insurance, telecom, utilities,
 *       phone_internet (categories where every charge IS the sub)
 *     - 'sometimes' for billers that wrap multiple products
 *       (apple, google, paypal, stripe, square), and for the few
 *       'other' / 'health' / 'food_delivery' catalog entries where
 *       the brand sells both subs and one-offs.
 *     - 'never' for the bank_fees category (interest charges,
 *       overdraft fees — recurring but not subscriptions).
 *   • decided_by = 'catalog'
 *   • model_version + prompt_version = null (this isn't a Claude
 *     verdict)
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   npx tsx scripts/backfill-brand-verdicts.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    "[backfill] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ──────────────────────────────────────────────────────────────────────
// Category → subscription_likelihood mapping.
//
// Conservative defaults — when in doubt, mark 'sometimes' so the
// doubt detection layer asks the user rather than silently confirming.
// 'always' is reserved for categories where literally every charge
// from the brand IS the subscription fee.
// ──────────────────────────────────────────────────────────────────────

const ALWAYS_CATEGORIES = new Set([
  "streaming",
  "software",
  "news",
  "cloud_storage",
  "gaming",
  "fitness",
  "education",
  "insurance",
  "telecom",
  "utilities",
  "phone_internet",
]);

const NEVER_CATEGORIES = new Set([
  "bank_fees",
]);

// Known billers/passthroughs in the existing catalog. These wrap
// multiple products and need user resolution per charge.
const ALWAYS_SOMETIMES_KEYS = new Set([
  "apple",
  "google",
  "google_play",
  "paypal",
  "stripe",
  "square",
  "amazon",
]);

function likelihoodFor(
  key: string,
  category: string
): "always" | "sometimes" | "never" {
  if (ALWAYS_SOMETIMES_KEYS.has(key)) return "sometimes";
  if (NEVER_CATEGORIES.has(category)) return "never";
  if (ALWAYS_CATEGORIES.has(category)) return "always";
  // Default for any category we haven't explicitly classified
  // (health, food_delivery, retail, transportation, other, etc.) —
  // safe to ask the user.
  return "sometimes";
}

type CatalogMerchant = {
  key: string;
  display: string;
  category: string;
  aliases?: string[];
  domains?: string[];
};

type Catalog = {
  merchants: CatalogMerchant[];
};

async function main() {
  const catalogPath = resolve(__dirname, "..", "lib", "data", "merchant-catalog.json");
  const raw = readFileSync(catalogPath, "utf8");
  const catalog = JSON.parse(raw) as Catalog;

  if (!Array.isArray(catalog.merchants)) {
    // eslint-disable-next-line no-console
    console.error("[backfill] merchant-catalog.json has no merchants array");
    process.exit(2);
  }

  // eslint-disable-next-line no-console
  console.log(`[backfill] processing ${catalog.merchants.length} merchants`);

  const rows = catalog.merchants.map((m) => {
    const likelihood = likelihoodFor(m.key, m.category);
    return {
      merchant_key: m.key,
      display_name: m.display,
      category: m.category,
      subscription_likelihood: likelihood,
      domain: (m.domains && m.domains[0]) || null,
      decided_by: "catalog" as const,
      decided_at: new Date().toISOString(),
      model_version: null,
      prompt_version: null,
      raw_descriptor_samples: m.aliases ?? [],
      updated_at: new Date().toISOString(),
    };
  });

  // Bulk upsert in chunks to avoid PostgREST request-size limits.
  const CHUNK = 100;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("brand_verdicts")
      .upsert(slice, { onConflict: "merchant_key" });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[backfill] chunk failed", { i, error });
      process.exit(3);
    }
    written += slice.length;
  }

  // Summary by likelihood for sanity-check.
  const summary = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.subscription_likelihood] = (acc[r.subscription_likelihood] ?? 0) + 1;
    return acc;
  }, {});

  // eslint-disable-next-line no-console
  console.log(`[backfill] wrote ${written} rows`);
  // eslint-disable-next-line no-console
  console.log("[backfill] likelihood distribution:", summary);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[backfill] fatal", e);
  process.exit(99);
});
