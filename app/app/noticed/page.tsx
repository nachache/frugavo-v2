import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Radar } from "lucide-react";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import { composeFindings, type Finding, kindLabel } from "@/lib/selectors/findings";
import { supabaseAdmin } from "@/lib/supabase";

// /app/noticed — the "Frugavo noticed" findings feed.
//
// Reached from the featured noticed card on the home switchboard. A
// vertical feed of finding cards. Each card uses verb-led headline,
// plain-language conclusion, confidence indicator (High/Med/Low),
// "Why we think this:" reasoning, and a potential-impact line.
//
// Tapping a finding routes to /app/noticed/[id] for the detail view
// (full reasoning, underlying evidence, resolve action).

export const dynamic = "force-dynamic";

export default async function NoticedFeedPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const data = await buildDashboardData(user.id);

  // Resolved findings — filtered from the feed via the aggregator.
  // Best-effort read; failures degrade to "show everything."
  const resolvedFindingIds = await (async () => {
    try {
      if (!supabaseAdmin) return new Set<string>();
      const { data: rows } = await supabaseAdmin
        .from("feedback_finding_resolve")
        .select("finding_id")
        .eq("clerk_user_id", user.id);
      const out = new Set<string>();
      for (const r of (rows ?? []) as Array<{ finding_id: string }>) {
        out.add(r.finding_id);
      }
      return out;
    } catch {
      return new Set<string>();
    }
  })();

  const findings = data
    ? composeFindings({
        moneyLeaks: data.money_leaks,
        shockInsights: data.shock_insights,
        concentration: data.concentration,
        actionItems: [
          ...data.actions.worth_a_look,
          ...data.actions.watching,
        ],
        resolvedFindingIds,
      })
    : [];

  return (
    <section className="container-page max-w-[780px] py-6 md:py-10">
      {/* Header — back affordance + title + count. Badge-on-top of
          the title per the locked design rule. */}
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition mb-5"
      >
        <ChevronLeft size={14} strokeWidth={2} />
        Back
      </Link>
      <div className="flex items-center gap-2.5 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-ink/[0.05] text-ink">
          <Radar size={14} strokeWidth={2} />
        </span>
        <h1 className="font-display text-[24px] md:text-[28px] font-medium tracking-[-0.01em] text-ink leading-tight">
          Frugavo noticed
        </h1>
      </div>
      <p className="text-[12.5px] text-ink-muted ml-[40px]">
        {findings.length} finding{findings.length === 1 ? "" : "s"} ·
        forecast, not guaranteed
      </p>

      {/* Feed */}
      <div className="mt-7 space-y-3">
        {findings.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-white p-6">
            <div className="text-[14px] font-medium text-ink">
              Nothing flagged right now
            </div>
            <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">
              When something changes — a price increase, a forgotten trial,
              a duplicate — it&apos;ll appear here.
            </p>
          </div>
        ) : (
          findings.map((f) => <FindingCard key={f.id} finding={f} />)
        )}
      </div>
    </section>
  );
}

// ─── Finding card ───────────────────────────────────────────────

function FindingCard({ finding }: { finding: Finding }) {
  const href = `/app/noticed/${encodeURIComponent(finding.id)}`;
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6 transition-all hover:bg-canvas/40 hover:shadow-float"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-ink/[0.05] px-2 h-5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-body">
            {kindLabel(finding.kind)}
          </span>
          <ConfidencePill
            tier={finding.confidenceTier}
            probability={finding.confidence}
          />
        </div>
        <ChevronRight
          size={16}
          strokeWidth={2}
          className="text-ink-muted group-hover:text-ink transition-colors mt-0.5"
        />
      </div>
      <h3 className="mt-3 text-[17px] md:text-[18px] font-bold text-ink leading-snug">
        {finding.headline}
      </h3>
      <p className="mt-2 text-[14px] md:text-[15px] text-ink-body leading-relaxed">
        {finding.conclusion}
      </p>

      <div className="mt-4 pt-4 border-t border-hairline/60 space-y-1.5">
        <div className="text-[12.5px] text-ink leading-relaxed">
          <span className="text-ink-muted">Why we think this:</span>{" "}
          {finding.why}
        </div>
        {finding.potentialImpactLabel ? (
          <div className="text-[12.5px] text-ink-body leading-relaxed">
            {finding.potentialImpactLabel}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

// ─── Confidence pill ────────────────────────────────────────────

// Three-tier label (High / Medium / Low) per spec. No hardcoded
// percentages. The percent column gets re-introduced if/when the
// engine ships a real per-finding confidence score (TODO comment in
// lib/selectors/findings.ts).
function ConfidencePill({
  tier,
  probability,
}: {
  tier: "high" | "medium" | "low";
  probability: number;
}) {
  const cls =
    tier === "high"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : tier === "medium"
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : "bg-ink/[0.05] text-ink-muted border-hairline";
  const label =
    tier === "high"
      ? "High confidence"
      : tier === "medium"
        ? "Medium confidence"
        : "Low confidence";
  const pct = Math.round(probability * 100);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 h-5 text-[10.5px] font-medium uppercase tracking-[0.08em] ${cls}`}
    >
      {label}
      <span className="opacity-70 tabular-nums normal-case tracking-normal">
        · {pct}%
      </span>
    </span>
  );
}
