import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { upsertMerchant } from "@/lib/merchants-store";
import catalog from "@/lib/data/merchant-catalog.json";

// POST /api/dev/seed-merchants
//
// One-time bootstrap for the probabilistic scoring system. Walks the
// curated merchant-catalog.json and upserts each entry into the
// `merchants` table with a strong dictionary prior:
//
//   alpha = 50  (strong positive evidence the merchant IS a subscription)
//   beta  = 1   (essentially zero negative evidence)
//
// posterior_mean = 50 / 51 ≈ 0.98 → log-odds ≈ +3.9, which combined
// with a typical pattern_log_odds of -2 (cold-start) yields finalP ≈
// sigmoid(1.9) ≈ 0.87 — well into the subscription band. New users
// thus get good behavior on Netflix, Spotify, etc. on day one.
//
// Idempotent — re-running just refreshes the dictionary set. NOT for
// production end-users; gated to FRUGAVO_SANDBOX_DEMO_USER_ID.

export const runtime = "nodejs";
export const maxDuration = 60;

type CatalogMerchant = {
  key: string;
  display: string;
  category: string;
  ai?: boolean;
  aliases?: string[];
  domains?: string[];
};

type CatalogBiller = {
  key: string;
  display: string;
  aliases?: string[];
  domains?: string[];
};

type CatalogShape = {
  merchants?: CatalogMerchant[];
  billers?: CatalogBiller[];
};

const DICTIONARY_ALPHA = 50;
const DICTIONARY_BETA = 1;
// Billers like Apple, PayPal, Stripe are NOT subscriptions on their
// own — they wrap real merchants. Seed them but at neutral prior so
// the engine doesn't auto-confirm everything that passes through them.
const BILLER_ALPHA = 1;
const BILLER_BETA = 1;

export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const allowed = process.env.FRUGAVO_SANDBOX_DEMO_USER_ID;
  if (!allowed || allowed !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const c = catalog as unknown as CatalogShape;
  let merchantCount = 0;
  let billerCount = 0;
  const errors: string[] = [];

  for (const m of c.merchants ?? []) {
    try {
      await upsertMerchant({
        merchant_key: m.key,
        display_name: m.display,
        category: m.category,
        alpha: DICTIONARY_ALPHA,
        beta: DICTIONARY_BETA,
        is_dictionary_seed: true,
        domains: m.domains ?? [],
        meta: {
          ai: m.ai === true,
          aliases: m.aliases ?? [],
        },
      });
      merchantCount++;
    } catch (e) {
      errors.push(
        `merchant:${m.key} - ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  for (const b of c.billers ?? []) {
    try {
      await upsertMerchant({
        merchant_key: b.key,
        display_name: b.display,
        category: "other",
        alpha: BILLER_ALPHA,
        beta: BILLER_BETA,
        is_dictionary_seed: false, // billers aren't auto-subscriptions
        domains: b.domains ?? [],
        meta: {
          is_biller: true,
          aliases: b.aliases ?? [],
        },
      });
      billerCount++;
    } catch (e) {
      errors.push(
        `biller:${b.key} - ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return NextResponse.json({
    ok: true,
    merchants_seeded: merchantCount,
    billers_seeded: billerCount,
    errors,
    dictionary_prior: { alpha: DICTIONARY_ALPHA, beta: DICTIONARY_BETA },
    biller_prior: { alpha: BILLER_ALPHA, beta: BILLER_BETA },
  });
}
