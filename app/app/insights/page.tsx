import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { BarChart3 } from "lucide-react";
import { BackPill } from "@/components/app/back-pill";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import type { HealthScore } from "@/lib/intelligence/health-score";
import type { MonthBucket, CategoryTotal } from "@/lib/insights";

// /app/insights — patterns + analytics.
//
// PASS 2 rebuild:
//   1. Subscription Health Score moved here from the personality card
//      so the card stays focused on identity / share.
//   2. 12-month spend chart (rendered server-side as a tiny SVG
//      area chart — no client JS, no library cost).
//   3. Category breakdown table so the user can see where the money
//      actually goes, not just the total.
//   4. Existing shock_insights list at the bottom.
//
// All visuals are server-rendered SVG — no Recharts/D3 dependency
// for a page that's read-only.

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const data = await buildDashboardData(user.id);
  const insights = data?.shock_insights ?? [];
  const chart = data?.chart_12mo ?? [];
  const categories = data?.subscription_categories ?? [];
  const healthScore = data?.health_score ?? null;
  const monthlyCents = data?.monthly.sub_only_cents ?? 0;
  const subCount = data?.monthly.sub_only_count ?? 0;

  return (
    <section className="container-page max-w-[820px] py-6 md:py-10">
      <div className="mb-5">
        <BackPill href="/app" label="Back to dashboard" />
      </div>

      <div className="flex items-center gap-2.5 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-ink/[0.05] text-ink">
          <BarChart3 size={14} strokeWidth={2} />
        </span>
        <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-[-0.01em] text-ink leading-tight">
          Insights
        </h1>
      </div>
      <p className="ml-[40px] text-[13px] text-ink-muted">
        Patterns Frugavo noticed about your recurring spend.
      </p>

      {/* ─── Health score — top of the page ─────────────────── */}
      <div className="mt-7">
        {healthScore ? (
          <HealthScoreBlock score={healthScore} />
        ) : (
          <PlaceholderCard
            title="Score in progress"
            body="Your subscription health score appears once the first scan completes."
          />
        )}
      </div>

      {/* ─── 12-month chart ─────────────────────────────────── */}
      <div className="mt-5">
        <SpendChartCard buckets={chart} />
      </div>

      {/* ─── Category breakdown ─────────────────────────────── */}
      <div className="mt-5">
        <CategoryBreakdownCard
          categories={categories}
          monthlyTotalCents={monthlyCents}
          subCount={subCount}
        />
      </div>

      {/* ─── Shock insights ─────────────────────────────────── */}
      <h2 className="section-title mt-10">Patterns</h2>
      <div className="mt-3 space-y-3">
        {insights.length === 0 ? (
          <PlaceholderCard
            title="No patterns yet"
            body="Once Frugavo has more billing history, patterns about your recurring spending will appear here."
          />
        ) : (
          insights.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6"
            >
              <h3 className="text-[16px] font-bold text-ink leading-snug">
                {s.headline}
              </h3>
              <p className="mt-1.5 text-[13.5px] text-ink-body leading-relaxed">
                {s.detail}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ─── Health score block ────────────────────────────────────────

function HealthScoreBlock({ score }: { score: HealthScore }) {
  const min = 300;
  const max = 850;
  const pct = Math.max(0, Math.min(1, (score.score - min) / (max - min)));
  const bandColor =
    score.band === "excellent" || score.band === "strong"
      ? "#047857"
      : score.band === "healthy"
        ? "#0F6E56"
        : score.band === "fair"
          ? "#D97706"
          : "#B91C1C";
  return (
    <div className="rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
            Subscription health
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div
              className="font-display text-[44px] md:text-[56px] font-bold tracking-[-0.02em] tabular-nums leading-none"
              style={{ color: bandColor }}
            >
              {score.score}
            </div>
            <div className="text-[13px] text-ink-muted">/ 850</div>
          </div>
          <div
            className="mt-1.5 text-[13px] font-medium"
            style={{ color: bandColor }}
          >
            {score.bandLabel}
          </div>
        </div>
        {/* Compact factor breakdown — four bars stacked. Reads as
            a tiny dashboard so the score doesn't feel like a black
            box. */}
        <div className="min-w-[220px] flex-1 max-w-[320px] space-y-2">
          <FactorBar label="Diversification" value={score.factors.diversification} />
          <FactorBar label="Stability" value={score.factors.stability} />
          <FactorBar label="Engagement" value={score.factors.engagement} />
          <FactorBar label="Recency" value={score.factors.recencyDrift} />
        </div>
      </div>
      <div className="mt-4 h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(pct * 100)}%`,
            background: bandColor,
          }}
        />
      </div>
      <p className="mt-4 text-[13.5px] text-ink-body leading-relaxed">
        {score.summary}
      </p>
      <p className="mt-2 text-[11.5px] text-ink-muted leading-relaxed">
        Score blends diversification, stability, engagement and recency
        signals from your last 12 months. Internal methodology — not a
        peer comparison.
      </p>
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px] text-ink-muted">
        <span>{label}</span>
        <span className="tabular-nums text-ink-body">{Math.round(pct)}</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-ink/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-ink"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Format "YYYY-MM" → "Jun". Avoids new Date() locale drift on a
// bare month string by parsing manually.
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function monthLabel(ym: string): string {
  const m = parseInt(ym.slice(5, 7), 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return ym;
  return MONTH_NAMES[m - 1];
}

// ─── Spend chart card ──────────────────────────────────────────

function SpendChartCard({ buckets }: { buckets: MonthBucket[] }) {
  // Need at least 2 points to draw a line.
  if (buckets.length < 2) {
    return (
      <PlaceholderCard
        title="Trend in progress"
        body="Your monthly spend chart appears as soon as we have at least two months of history."
      />
    );
  }

  const W = 640;
  const H = 180;
  const PAD_X = 14;
  const PAD_Y = 22;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  const max = Math.max(1, ...buckets.map((b) => b.spend_cents));
  const min = 0;
  const range = Math.max(1, max - min);

  const points = buckets.map((b, i) => {
    const x = PAD_X + (i / Math.max(1, buckets.length - 1)) * innerW;
    const y = PAD_Y + innerH - ((b.spend_cents - min) / range) * innerH;
    return { x, y, ...b };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    path +
    ` L${points[points.length - 1].x.toFixed(1)},${(PAD_Y + innerH).toFixed(1)}` +
    ` L${points[0].x.toFixed(1)},${(PAD_Y + innerH).toFixed(1)} Z`;

  const last = buckets[buckets.length - 1];
  const prev = buckets[buckets.length - 2];
  const delta = last.spend_cents - prev.spend_cents;
  const deltaPct = prev.spend_cents > 0
    ? Math.round((delta / prev.spend_cents) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
            Monthly spend · last 12 months
          </div>
          <div className="mt-2 text-[28px] md:text-[32px] font-bold tracking-[-0.01em] text-ink tabular-nums leading-none">
            ${Math.round(last.spend_cents / 100).toLocaleString("en-US")}
            <span className="ml-1.5 text-[13px] font-medium text-ink-muted">
              {monthLabel(last.month)}
            </span>
          </div>
        </div>
        <div className="text-[12px] text-ink-muted">
          {delta === 0 ? (
            <span>Flat vs {monthLabel(prev.month)}</span>
          ) : (
            <span>
              {delta > 0 ? "+" : ""}
              {deltaPct}% vs {monthLabel(prev.month)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block"
          preserveAspectRatio="none"
          aria-label="12-month spend chart"
        >
          <defs>
            <linearGradient id="insights-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#047857" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Subtle grid baseline */}
          <line
            x1={PAD_X}
            y1={PAD_Y + innerH}
            x2={W - PAD_X}
            y2={PAD_Y + innerH}
            stroke="#E5E5E5"
            strokeWidth="1"
          />
          <path d={areaPath} fill="url(#insights-area-fill)" />
          <path
            d={path}
            fill="none"
            stroke="#047857"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p) => (
            <circle
              key={p.month}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill="white"
              stroke="#047857"
              strokeWidth="1.5"
            />
          ))}
        </svg>
        <div className="mt-2 flex justify-between text-[10.5px] text-ink-muted tabular-nums">
          {buckets.map((b, i) =>
            i === 0 ||
            i === buckets.length - 1 ||
            i === Math.floor(buckets.length / 2) ? (
              <span key={b.month}>{monthLabel(b.month)}</span>
            ) : (
              <span key={b.month} aria-hidden="true">
                &nbsp;
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Category breakdown ────────────────────────────────────────

function CategoryBreakdownCard({
  categories,
  monthlyTotalCents,
  subCount,
}: {
  categories: CategoryTotal[];
  monthlyTotalCents: number;
  subCount: number;
}) {
  if (categories.length === 0) {
    return (
      <PlaceholderCard
        title="Breakdown unavailable"
        body="Once subscriptions are confirmed, you'll see how they split across categories here."
      />
    );
  }
  const ordered = [...categories].sort(
    (a, b) => b.monthly_cents - a.monthly_cents
  );
  const total = monthlyTotalCents > 0 ? monthlyTotalCents : 1;

  return (
    <div className="rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
            Where it goes
          </div>
          <div className="mt-1 text-[16px] font-bold text-ink leading-snug">
            {ordered.length} categor{ordered.length === 1 ? "y" : "ies"} ·{" "}
            {subCount} sub{subCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        {ordered.map((c) => {
          const pct = (c.monthly_cents / total) * 100;
          return (
            <li key={c.category}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-ink font-medium truncate">
                  {c.category}
                </span>
                <span className="text-ink-muted tabular-nums text-[12.5px]">
                  ${Math.round(c.monthly_cents / 100).toLocaleString("en-US")}
                  /mo
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-ink/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, pct)}%`,
                    background: "#047857",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Shared placeholder ────────────────────────────────────────

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white shadow-soft p-6">
      <div className="text-[14px] font-bold text-ink">{title}</div>
      <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">
        {body}
      </p>
    </div>
  );
}
