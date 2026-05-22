import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  scoreCandidate,
  featuresFromCharges,
  THRESHOLD_ONE_OFF,
  THRESHOLD_SUBSCRIPTION,
  type CandidateFeatures,
} from "@/lib/scoring";
import {
  getMerchantPriors,
  getMerchantDictionary,
} from "@/lib/merchants-store";
import { getOverridesForUser } from "@/lib/user-overrides";
import { pickModelForUser } from "@/lib/model-store";

// GET /api/scoring/uncertain
//
// Active-learning surface. Scores every one of the user's
// subscriptions on the fly using the probabilistic system
// (lib/scoring + merchant priors + user overrides) and returns the
// subset that falls in the uncertain band (0.4 ≤ p < 0.6).
//
// The dashboard's "Help us learn" carousel reads this. Each card the
// user labels feeds the merchant prior and shifts that candidate out
// of the band on the next call.
//
// Already-labelled candidates are excluded (an override pins the
// decision deterministically, so there's nothing to ask about).
//
// Returns at most `limit` cards (default 8) so the dashboard isn't
// overwhelmed; the user works through them as they accumulate.

export const runtime = "nodejs";
export const maxDuration = 10;

type SubRow = {
  id: string;
  merchant_key: string | null;
  merchant_name: string;
  category: string;
  amount_cents: number;
  currency: string;
  frequency: string;
  status: string;
};

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit") ?? "8"))
  );

  // ---- 1. Pull active subscriptions ----
  const { data: subsData, error: subsErr } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_key, merchant_name, category, amount_cents, currency, frequency, status"
    )
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .not("merchant_key", "is", null);
  if (subsErr) {
    return NextResponse.json(
      { error: "subs_read_failed", details: subsErr.message },
      { status: 500 }
    );
  }
  const subs = (subsData ?? []) as SubRow[];
  if (subs.length === 0) {
    return NextResponse.json({ ok: true, candidates: [], total: 0 });
  }

  // ---- 2. Pull this user's accepted charges (paginated). ----
  type Charge = {
    subscription_id: string;
    posted_date: string;
    amount_cents: number;
  };
  const charges: Charge[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (offset < 100_000) {
    const { data, error } = await supabaseAdmin
      .from("subscription_charges")
      .select("subscription_id, posted_date, amount_cents")
      .eq("user_id", user.id)
      .eq("detector_status", "accepted")
      .order("posted_date", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break;
    const page = (data ?? []) as Charge[];
    charges.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  const chargesBySub = new Map<string, Charge[]>();
  for (const c of charges) {
    const arr = chargesBySub.get(c.subscription_id) ?? [];
    arr.push(c);
    chargesBySub.set(c.subscription_id, arr);
  }

  // ---- 3. Batch-fetch priors + dictionary + overrides ----
  const merchantKeys = Array.from(
    new Set(subs.map((s) => s.merchant_key!).filter(Boolean))
  );
  const [priors, dictionary, overrides, model] = await Promise.all([
    getMerchantPriors(merchantKeys),
    getMerchantDictionary(),
    getOverridesForUser(user.id),
    pickModelForUser(user.id),
  ]);

  // ---- 4. Score every sub. Filter to uncertain band, drop already
  // overridden ones (the user has spoken on those). ----
  type Card = {
    subscription_id: string;
    merchant_name: string;
    merchant_key: string;
    category: string;
    amount_cents: number;
    frequency: string;
    occurrences: number;
    last_charge_date: string | null;
    probability: number;
    decision: "uncertain";
    prior_alpha: number;
    prior_beta: number;
    in_dictionary: boolean;
  };
  const cards: Card[] = [];

  for (const sub of subs) {
    if (!sub.merchant_key) continue;
    if (overrides.has(sub.merchant_key)) continue;

    const subCharges = chargesBySub.get(sub.id) ?? [];
    const f = featuresFromCharges(subCharges);
    const features: CandidateFeatures = {
      merchant_key: sub.merchant_key,
      regularity: f.regularity,
      amount_consistency: f.amount_consistency,
      occurrences: f.occurrences,
      category: sub.category,
      in_dictionary: dictionary.has(sub.merchant_key),
    };

    const result = scoreCandidate({
      features,
      prior: priors.get(sub.merchant_key),
      coeffs: model.coefficients,
    });

    if (
      result.probability >= THRESHOLD_ONE_OFF &&
      result.probability < THRESHOLD_SUBSCRIPTION
    ) {
      cards.push({
        subscription_id: sub.id,
        merchant_name: sub.merchant_name,
        merchant_key: sub.merchant_key,
        category: sub.category,
        amount_cents: sub.amount_cents,
        frequency: sub.frequency,
        occurrences: f.occurrences,
        last_charge_date:
          subCharges.length > 0
            ? subCharges[subCharges.length - 1].posted_date
            : null,
        probability: result.probability,
        decision: "uncertain",
        prior_alpha: result.prior_alpha,
        prior_beta: result.prior_beta,
        in_dictionary: features.in_dictionary,
      });
    }
  }

  // ---- 5. Sort by entropy — most uncertain first ----
  // |p - 0.5| smallest means least confident, which is where labelling
  // gives the most information.
  cards.sort(
    (a, b) =>
      Math.abs(a.probability - 0.5) - Math.abs(b.probability - 0.5)
  );

  return NextResponse.json(
    {
      ok: true,
      total: cards.length,
      candidates: cards.slice(0, limit),
    },
    { headers: { "Cache-Control": "private, no-store, must-revalidate" } }
  );
}
