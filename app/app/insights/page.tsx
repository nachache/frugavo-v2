import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { ChevronLeft, BarChart3 } from "lucide-react";
import { buildDashboardData } from "@/lib/selectors/dashboard";

// /app/insights — patterns/insights stub.
//
// Reached from the Insights card on the home switchboard. Light
// surface showing the engine's existing shock_insights as a flat
// list. The deeper analytical view is future scope; this stub keeps
// the link target real without inventing content.

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const data = await buildDashboardData(user.id);
  const insights = data?.shock_insights ?? [];

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
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-ink/[0.05] text-ink">
          <BarChart3 size={14} strokeWidth={2} />
        </span>
        <h1 className="font-display text-[24px] md:text-[28px] font-medium tracking-[-0.01em] text-ink leading-tight">
          Insights
        </h1>
      </div>
      <p className="ml-[40px] text-[13px] text-ink-muted">
        Patterns Frugavo noticed about your recurring spend.
      </p>

      <div className="mt-7 space-y-3">
        {insights.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-white p-6">
            <div className="text-[14px] font-medium text-ink">
              No patterns yet
            </div>
            <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">
              Once Frugavo has more billing history, patterns about your
              recurring spending will appear here.
            </p>
          </div>
        ) : (
          insights.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-hairline bg-white p-5 md:p-6"
            >
              <h3 className="text-[15px] font-medium text-ink leading-snug">
                {s.headline}
              </h3>
              <p className="mt-1.5 text-[13px] text-ink-body leading-relaxed">
                {s.detail}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
