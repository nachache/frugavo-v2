import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { ChevronLeft, Wallet } from "lucide-react";
import { buildDashboardData } from "@/lib/selectors/dashboard";

// /app/spending — spending breakdown stub.
//
// Reached from the Spending card on the home switchboard. This is
// the lightweight stub per spec ("Opens the spending breakdown
// (route exists or stub it).") — minimal placeholder until the
// richer breakdown view is designed.
//
// What's here today: the headline number + a list of categories from
// buildDashboardData. The future detail view would add a donut, AI
// stack, and category drill-down.

export const dynamic = "force-dynamic";

export default async function SpendingPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const data = await buildDashboardData(user.id);
  const monthlyCents = data?.monthly.sub_only_cents ?? 0;
  const categories = (data?.subscription_categories ?? []).filter(
    (c) => c.monthly_cents > 0
  );
  const total = categories.reduce((acc, c) => acc + c.monthly_cents, 0);

  return (
    <section className="container-page max-w-[780px] py-6 md:py-10">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition mb-5"
      >
        <ChevronLeft size={14} strokeWidth={2} />
        Back
      </Link>

      <div className="flex items-center gap-2.5 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-900">
          <Wallet size={14} strokeWidth={2} />
        </span>
        <h1 className="font-display text-[24px] md:text-[28px] font-medium tracking-[-0.01em] text-ink leading-tight">
          Spending
        </h1>
      </div>
      <div className="ml-[40px] text-[13px] text-ink-body tabular-nums">
        ${Math.round(monthlyCents / 100).toLocaleString("en-US")}/mo recurring
      </div>

      <div className="mt-7 rounded-2xl border border-hairline bg-white overflow-hidden">
        <ul className="divide-y divide-hairline/60">
          {categories.length === 0 ? (
            <li className="px-5 py-6 text-[13px] text-ink-muted">
              No categorized recurring spend yet.
            </li>
          ) : (
            categories.map((c) => {
              const share = total > 0 ? (c.monthly_cents / total) * 100 : 0;
              return (
                <li
                  key={c.category}
                  className="px-5 py-4 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-ink truncate">
                      {prettyCategory(c.category)}
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-ink/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${share}%`,
                          background: "#0F6E56",
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-[13px] text-ink tabular-nums shrink-0">
                    ${Math.round(c.monthly_cents / 100).toLocaleString("en-US")}
                  </div>
                  <div className="text-[12px] text-ink-muted tabular-nums w-10 text-right shrink-0">
                    {Math.round(share)}%
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </section>
  );
}

function prettyCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
