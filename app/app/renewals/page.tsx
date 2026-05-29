import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { ChevronLeft, Calendar } from "lucide-react";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import type { ActionItem } from "@/lib/selectors/dashboard";
import { RenewalsCalendar } from "@/components/app/renewals-calendar";

// /app/renewals — full-month renewals calendar.
//
// Reached from the Renewals card on the home switchboard. FULL CALENDAR
// MONTH (not the 14-day list). Standard Sun–Sat grid with leading and
// trailing days drawn from prev/next months. Today is visually marked.
// Days with one or more predicted charges get a marker dot + count.
//
// Tapping a day reveals that day's predicted charges below the grid
// as an agenda group. Each charge row shows merchant, amount, and a
// prediction-confidence pill (High/Medium/Low — no hardcoded
// percentages, per the confidence-honesty rule).
//
// Month nav is a URL search param (?ym=YYYY-MM) so the view is
// bookmarkable and back-button-safe. Defaults to the current month.
//
// Confidence rule for THIS page (read carefully):
//   We have per-subscription confidence (subscriptions.confidence,
//   0..1 from Claude phase F). We do NOT have a per-DATE prediction
//   score. To honor the spec's confidence honesty without inventing
//   numbers, we map a tier based on TWO real engine signals:
//     • subscription.confidence (the verdict score)
//     • months_observed (how much billing history backs the cadence)
//   See deriveRenewalConfidenceTier() in renewals-calendar.tsx for
//   the exact tier rules and the TODO for a future real score.

export const dynamic = "force-dynamic";

type Search = { ym?: string; day?: string };

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams?: Search;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const data = await buildDashboardData(user.id);
  const upcoming: ActionItem[] = data
    ? [...data.actions.worth_a_look, ...data.actions.watching].filter(
        (a) =>
          a.next_expected_charge_at &&
          a.override_type !== "cancelled" &&
          a.override_type !== "not_subscription" &&
          a.override_type !== "not_recurring"
      )
    : [];

  // Parse the month from the URL or default to current.
  const ym = parseYearMonth(searchParams?.ym);
  const selectedDay = parseDay(searchParams?.day, ym);

  // Total expected this month — sum monthly_cents for renewals whose
  // expected date falls inside the displayed month. Uses ActionItem
  // amounts which respect the user's overrides. The spec's "forecast,
  // not guaranteed" disclaimer renders right next to the total.
  const monthStart = new Date(ym.year, ym.month, 1);
  const monthEnd = new Date(ym.year, ym.month + 1, 1);
  const inMonth = upcoming.filter((a) => {
    const d = new Date(a.next_expected_charge_at as string);
    return d >= monthStart && d < monthEnd;
  });
  const monthTotalCents = inMonth.reduce((acc, a) => acc + a.monthly_cents, 0);

  const monthLabel = monthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const prevYm = yearMonthOffset(ym, -1);
  const nextYm = yearMonthOffset(ym, +1);

  return (
    <section className="container-page max-w-[920px] py-6 md:py-10">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition mb-5"
      >
        <ChevronLeft size={14} strokeWidth={2} />
        Back to dashboard
      </Link>

      <div className="flex items-center gap-2.5 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-ink/[0.05] text-ink">
          <Calendar size={14} strokeWidth={2} />
        </span>
        <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-[-0.01em] text-ink leading-tight">
          Renewals
        </h1>
      </div>
      <div className="ml-[40px] flex items-baseline justify-between gap-4 flex-wrap">
        <div className="text-[13px] text-ink-body tabular-nums">
          ~${Math.round(monthTotalCents / 100).toLocaleString("en-US")}{" "}
          expected this month
          <span className="text-ink-muted ml-2 text-[11.5px]">
            · forecast, not guaranteed
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <MonthNavLink href={`/app/renewals?ym=${prevYm}`} prev />
          <span className="text-[12.5px] font-medium text-ink min-w-[120px] text-center">
            {monthLabel}
          </span>
          <MonthNavLink href={`/app/renewals?ym=${nextYm}`} />
        </div>
      </div>

      <div className="mt-7">
        <RenewalsCalendar
          year={ym.year}
          month={ym.month}
          upcoming={upcoming}
          initialSelectedIso={selectedDay}
        />
      </div>
    </section>
  );
}

// ─── helpers ────────────────────────────────────────────────────

function parseYearMonth(s: string | undefined): { year: number; month: number } {
  if (s) {
    const m = /^(\d{4})-(\d{2})$/.exec(s);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      if (year >= 2020 && year <= 2100 && month >= 0 && month <= 11) {
        return { year, month };
      }
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function yearMonthOffset(
  ym: { year: number; month: number },
  delta: number
): string {
  const d = new Date(ym.year, ym.month + delta, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseDay(
  s: string | undefined,
  ym: { year: number; month: number }
): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (year !== ym.year || month !== ym.month) return null;
  return s;
}

function MonthNavLink({ href, prev = false }: { href: string; prev?: boolean }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-hairline bg-white text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition"
      aria-label={prev ? "Previous month" : "Next month"}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: prev ? undefined : "scaleX(-1)" }}
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </Link>
  );
}
