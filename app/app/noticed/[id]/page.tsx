import { redirect, notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { ChevronLeft, Radar } from "lucide-react";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import { composeFindings } from "@/lib/selectors/findings";
import { FindingResolveActions } from "@/components/app/finding-resolve-actions";
import { supabaseAdmin } from "@/lib/supabase";

// /app/noticed/[id] — single-finding detail view.
//
// Reached from the noticed feed. Shows full reasoning, the
// underlying subscription evidence (when present), and a resolve
// action that writes a user_overrides row via the existing
// /api/feedback path.
//
// Spec compliance: the verb-led headline, plain-language conclusion,
// confidence indicator, "Why we think this:" reasoning, and
// potential-impact line are all rendered here. The resolve action
// uses "Look into it" / "Looks fine" wording per spec.

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
};

export default async function FindingDetailPage({ params }: Props) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const data = await buildDashboardData(user.id);

  // We DO NOT filter out resolved findings here — if the user
  // navigates back to a previously-resolved finding via deep link,
  // they should still see it. The feed page is what hides resolved
  // items from discovery.
  const resolvedIds = await (async () => {
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
        // Intentionally NOT passing resolvedFindingIds — see note above.
      })
    : [];

  const findingId = decodeURIComponent(params.id);
  const finding = findings.find((f) => f.id === findingId);
  if (!finding) {
    notFound();
  }
  const alreadyResolved = resolvedIds.has(finding.id);

  // Find the underlying subscription rows so the user can see the
  // evidence behind the finding.
  const evidenceSubs =
    data && finding.subscriptionIds.length > 0
      ? data.subscriptions.filter((s) =>
          finding.subscriptionIds.includes(s.id)
        )
      : [];

  return (
    <section className="container-page max-w-[720px] py-6 md:py-10">
      <Link
        href="/app/noticed"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition mb-5"
      >
        <ChevronLeft size={14} strokeWidth={2} />
        Back to findings
      </Link>

      <div className="flex items-center gap-2.5 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-ink/[0.05] text-ink">
          <Radar size={14} strokeWidth={2} />
        </span>
        <span className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
          Frugavo noticed
        </span>
      </div>

      <h1 className="mt-3 font-display text-[24px] md:text-[28px] font-medium tracking-[-0.01em] text-ink leading-tight">
        {finding.headline}
      </h1>
      <p className="mt-2 text-[14px] md:text-[15px] text-ink-body leading-relaxed">
        {finding.conclusion}
      </p>

      <div className="mt-6">
        <ConfidenceLine
          tier={finding.confidenceTier}
          probability={finding.confidence}
        />
      </div>

      <div className="mt-7 rounded-2xl border border-hairline bg-white p-5 md:p-6 space-y-3.5">
        <div>
          <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
            Why we think this
          </div>
          <p className="mt-1.5 text-[13.5px] text-ink-body leading-relaxed">
            {finding.why}
          </p>
        </div>
        {finding.potentialImpactLabel ? (
          <div className="pt-3.5 border-t border-hairline/60">
            <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
              Potential impact
            </div>
            <p className="mt-1.5 text-[13.5px] text-ink-body leading-relaxed">
              {finding.potentialImpactLabel}
            </p>
          </div>
        ) : null}
      </div>

      {evidenceSubs.length > 0 ? (
        <div className="mt-7">
          <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted mb-2.5 px-1">
            Underlying charges
          </div>
          <ul className="rounded-2xl border border-hairline bg-white divide-y divide-hairline/60 overflow-hidden">
            {evidenceSubs.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/app/subscriptions/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/40 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-ink truncate">
                      {s.merchant_name}
                    </div>
                    <div className="text-[12px] text-ink-muted">
                      {s.frequency} · last charge{" "}
                      {s.last_charged_at
                        ? new Date(s.last_charged_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )
                        : "—"}
                    </div>
                  </div>
                  <div className="text-[13px] font-medium text-ink tabular-nums">
                    ${Math.abs(s.amount_cents / 100).toFixed(2)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Resolve action — "Look into it" / "Looks fine" per spec.
          Writes to /api/feedback with override_type. Client
          component since it owns the click + redirect. */}
      <div className="mt-8">
        <FindingResolveActions
          finding={finding}
          subscriptionIds={finding.subscriptionIds}
          alreadyResolved={alreadyResolved}
        />
      </div>
    </section>
  );
}

// ─── Confidence inline line ─────────────────────────────────────

function ConfidenceLine({
  tier,
  probability,
}: {
  tier: "high" | "medium" | "low";
  probability: number;
}) {
  const label =
    tier === "high" ? "High" : tier === "medium" ? "Medium" : "Low";
  const dot =
    tier === "high"
      ? "bg-emerald-500"
      : tier === "medium"
        ? "bg-amber-500"
        : "bg-ink/30";
  const pct = Math.round(probability * 100);
  return (
    <div className="inline-flex items-center gap-2 text-[12.5px] text-ink-body">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>
        <span className="text-ink-muted">Confidence:</span>{" "}
        <span className="font-medium text-ink">{label}</span>{" "}
        <span className="text-ink-muted tabular-nums">· {pct}%</span>
      </span>
    </div>
  );
}
