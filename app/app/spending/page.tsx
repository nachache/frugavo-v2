import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { ChevronLeft, Wallet } from "lucide-react";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import { SubscriptionsBrowser } from "@/components/app/subscriptions-browser";

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
  const monthlyCents = data?.monthly.sub_only_cents ?? 0;

  // All confirmed subs — pull from worth_a_look + watching (the
  // ActionItem feed already excludes overrides like "not a sub",
  // "cancelled", "not recurring"). Same source the home cards use,
  // so the totals match.
  const subs = data
    ? [...data.actions.worth_a_look, ...data.actions.watching].filter(
        (a) =>
          a.override_type !== "not_subscription" &&
          a.override_type !== "not_recurring" &&
          a.override_type !== "cancelled"
      )
    : [];

  return (
    <section className="container-page max-w-[860px] py-6 md:py-10">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition mb-5"
      >
        <ChevronLeft size={14} strokeWidth={2} />
        Back to dashboard
      </Link>

      <div className="flex items-center gap-2.5 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-900">
          <Wallet size={14} strokeWidth={2} />
        </span>
        <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-[-0.01em] text-ink leading-tight">
          Your subs
        </h1>
      </div>
      <div className="ml-[40px] text-[13px] text-ink-body tabular-nums">
        ${Math.round(monthlyCents / 100).toLocaleString("en-US")}/mo recurring ·{" "}
        {subs.length} sub{subs.length === 1 ? "" : "s"}
      </div>

      <div className="mt-7">
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
          <SubscriptionsBrowser subs={subs} />
        )}
      </div>
    </section>
  );
}
