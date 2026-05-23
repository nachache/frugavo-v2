// Public-profile fetcher.
//
// Loads the privacy-conscious subset of a user's data that can
// safely appear on the public /u/<slug> share preview:
//   - personality label + sub
//   - aggregate monthly burn (no merchant names)
//   - subscription count
//
// Specifically NOT exposed: individual merchant names, categories,
// emails, names, anything that lets a stranger learn what services
// the user pays for.
//
// Returns null if the slug doesn't resolve to a real user.

import { supabaseAdmin } from "@/lib/supabase";
import {
  computeBurnRate,
  computeAiSpend,
  computeCategoryTotals,
  type LedgerCharge,
  type LedgerSubscription,
} from "@/lib/insights";
import { computePersonality } from "@/lib/personality";
import { findUserBySlug } from "@/lib/users/public-slug";

export type PublicProfile = {
  slug: string;
  personality_label: string;
  personality_sub: string;
  monthly_burn_cents: number;
  subscription_count: number;
};

export async function loadPublicProfile(
  slug: string
): Promise<PublicProfile | null> {
  if (!supabaseAdmin) return null;

  const found = await findUserBySlug(slug);
  if (!found) return null;

  const userId = found.clerk_user_id;

  // Pull active subscriptions for burn + personality. Matches the
  // existing /api/share-card route's selector but trimmed to what
  // we actually expose publicly.
  const { data: subs } = await supabaseAdmin
    .from("subscriptions")
    .select("id, amount_cents, currency, frequency, category, status")
    .eq("user_id", userId)
    .neq("status", "cancelled");

  const { data: charges } = await supabaseAdmin
    .from("subscription_charges")
    .select("subscription_id, amount_cents, posted_date")
    .eq("user_id", userId);

  const ledgerSubs = (subs ?? []) as LedgerSubscription[];
  const ledgerCharges = (charges ?? []) as LedgerCharge[];
  const asOf = new Date();

  const burn = computeBurnRate(ledgerSubs, ledgerCharges, asOf);
  const ai = computeAiSpend(ledgerSubs, ledgerCharges, asOf);
  const categories = computeCategoryTotals(ledgerSubs);
  const personality = computePersonality({
    categories,
    aiMonthlyCents: ai.monthly_cents,
    totalMonthlyCents: burn.monthly_cents,
    totalSubCount: burn.active_subscription_count,
  });

  // Match the share-card identity SVG which uses the TOTAL recurring
  // view (subs + other) so the headline number reconciles with what
  // ever else we surface elsewhere on the public profile.
  return {
    slug,
    personality_label: personality.label,
    personality_sub: personality.sub,
    monthly_burn_cents: burn.total_monthly_cents,
    subscription_count: burn.total_active_count,
  };
}
