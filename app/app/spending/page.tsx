import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Wallet } from "lucide-react";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import { SubscriptionsBrowser } from "@/components/app/subscriptions-browser";
import { BackPill } from "@/components/app/back-pill";

// /app/spending — "Your subs" deep view.
//
// PASS 2 rebuild (task 107):
//   • Shows ALL confirmed subscriptions (was: just category list).
//   • Hands the SubscriptionsBrowser client component the full set;
//     it handles filtering, search, grouping, and the overlay modal.
//   • Modal exposes Cancel Assist + "Not a subscription" feedback so
//     the user never has to navigate away to manage a sub.

export const dynamic = "force-dynamic";

export default async function SpendingPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const data = await buildDashboardData(user.id);

  // All confirmed subs first; the not-a-sub / cancelled / not-recurring
  // overrides land in their own dimmed group below the live list so
  // the user can restore them with one tap.
  const allActionItems = data
    ? [
        ...data.actions.worth_a_look,
        ...data.actions.watching,
        ...data.actions.hidden,
      ]
    : [];
  const subs = allActionItems.filter(
    (a) =>
      a.override_type !== "not_subscription" &&
      a.override_type !== "not_recurring" &&
      a.override_type !== "cancelled"
  );
  const excludedSubs = allActionItems.filter(
    (a) =>
      a.override_type === "not_subscription" ||
      a.override_type === "not_recurring" ||
      a.override_type === "cancelled"
  );

  return (
    <section className="container-page max-w-[860px] py-6 md:py-10">
      <div className="mb-5">
        <BackPill href="/app" label="Back to dashboard" />
      </div>

      <div className="flex items-center gap-2.5 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-900">
          <Wallet size={14} strokeWidth={2} />
        </span>
        <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-[-0.01em] text-ink leading-tight">
          Your subs
        </h1>
      </div>
      {/* Live totals — the inline summary is rendered inside the
          browser so it reflects mark/restore mutations instantly,
          before router.refresh has reconciled with the server. */}

      <div className="mt-5">
        {subs.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-white p-6 text-center">
            <div className="text-[14px] font-bold text-ink">
              No confirmed subscriptions yet
            </div>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              They&apos;ll appear here as soon as the next scan finishes.
            </p>
          </div>
        ) : (
          <SubscriptionsBrowser subs={subs} excluded={excludedSubs} />
        )}
      </div>
    </section>
  );
}
