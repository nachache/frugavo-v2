import { supabaseAdmin } from "./supabase";
import {
  monthlyEquivalentCents,
  type SubLike,
} from "./subscription-math";

// "What should I do next?" engine. Returns one recommendation, scored
// by leverage. Surface on the dashboard as a single calm banner — never
// more than one at a time, to avoid task-list overwhelm.
//
// Ranking, highest to lowest:
//   1. Pending cancellations that have FAILED (provider still charging).
//   2. Cancel candidates the user hasn't reviewed (regret_score >= 60).
//   3. Subs with no activity in 35+ days (silent — likely forgotten).
//   4. Annual subs whose anniversary is in the next 14 days
//      (cancel-before-renewal window).
//   5. Nothing — return null and let the dashboard hide the banner.

export type Recommendation = {
  kind:
    | "failed_cancellation"
    | "review_candidates"
    | "silent_sub"
    | "renewal_window"
    | "first_scan_done";
  headline: string;
  body: string;
  cta?: { label: string; href: string };
  amount_cents?: number;
};

export async function nextRecommendation(
  userId: string
): Promise<Recommendation | null> {
  if (!supabaseAdmin) return null;

  // 1) Failed cancellations need attention now.
  const { data: failed } = await supabaseAdmin
    .from("cancellations")
    .select("subscription_id, outcome, notes")
    .eq("user_id", userId)
    .eq("outcome", "failed")
    .limit(1);
  if (failed && failed.length > 0) {
    return {
      kind: "failed_cancellation",
      headline: "One cancellation didn't take — the charge came back.",
      body:
        "We saw a charge after your cancellation attempt. Open the row and try again, or switch to the email template.",
      cta: { label: "Review", href: "/app" },
    };
  }

  // Load current active subs for the rest of the rules.
  const { data: subs } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, amount_cents, frequency, last_charged_at, next_expected_charge_at, regret_score, status, user_decision, merchant_name"
    )
    .eq("user_id", userId)
    .eq("status", "active");

  const active = (subs ?? []) as (SubLike & {
    regret_score?: number | null;
    user_decision?: string | null;
  })[];

  // 2) Cancel candidates the user hasn't acted on.
  const candidates = active.filter(
    (s) =>
      (s.regret_score ?? 0) >= 60 &&
      s.user_decision !== "keep" &&
      s.user_decision !== "cancel"
  );
  if (candidates.length > 0) {
    const totalAnnual = candidates.reduce(
      (sum, s) => sum + monthlyEquivalentCents(s.amount_cents, s.frequency) * 12,
      0
    );
    return {
      kind: "review_candidates",
      headline: `${candidates.length} subscription${candidates.length === 1 ? "" : "s"} worth a look`,
      body: `Up to $${Math.round(totalAnnual / 100).toLocaleString()}/yr in potential savings if you cancel.`,
      cta: { label: "See candidates", href: "/app#worth-a-look" },
      amount_cents: totalAnnual,
    };
  }

  // 3) Silent subs — no charge in 35+ days.
  const now = Date.now();
  const silent = active.find((s) => {
    if (!s.last_charged_at) return false;
    const days =
      (now - new Date(s.last_charged_at).getTime()) / 86_400_000;
    return days > 35;
  });
  if (silent) {
    const annual = monthlyEquivalentCents(silent.amount_cents, silent.frequency) * 12;
    return {
      kind: "silent_sub",
      headline: `${silent.merchant_name} hasn't charged in a while.`,
      body: `Worth ${dollars(annual)}/yr if it was already cancelled and you'd missed it. Confirm or move on.`,
      cta: { label: "Open subscription", href: "/app" },
      amount_cents: annual,
    };
  }

  // 4) Annual renewal window — 14 days out.
  const horizon = now + 14 * 86_400_000;
  const renewing = active.find((s) => {
    if (s.frequency !== "annually") return false;
    if (!s.next_expected_charge_at) return false;
    const t = new Date(s.next_expected_charge_at).getTime();
    return t > now && t <= horizon;
  });
  if (renewing) {
    const annual = renewing.amount_cents;
    return {
      kind: "renewal_window",
      headline: `${renewing.merchant_name} renews soon.`,
      body: `${dollars(annual)} charge expected within two weeks. If you don't want it, now's the time.`,
      cta: { label: "Decide", href: "/app" },
      amount_cents: annual,
    };
  }

  return null;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
