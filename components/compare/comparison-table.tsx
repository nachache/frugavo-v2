// Reusable comparison-table layout for /compare/[competitor] pages.
//
// Shape: hero with both names + tagline → side-by-side feature
// matrix with check/dash/text values → pricing card row →
// "Why Frugavo" summary → CTA back to /sign-up.
//
// Each /compare/[name] route hands this component a CompetitorSpec
// and the layout takes care of the rest. Keeps the three landing
// links to a single source of truth for design + verification.

import { Check, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CellValue =
  | { kind: "check" }
  | { kind: "x" }
  | { kind: "dash" }
  | { kind: "text"; value: string };

export type CompareRow = {
  feature: string;
  detail?: string;
  competitor: CellValue;
  frugavo: CellValue;
};

export type CompetitorSpec = {
  // Display name + short tagline used in the hero
  name: string;
  tagline: string;
  // Plain-text intro paragraph — sets up the "this is an honest
  // comparison, here's the punchline" framing
  intro: string;
  // The feature matrix
  rows: CompareRow[];
  // Bullet summary at the bottom — 3-5 reasons someone would pick Frugavo
  pickFrugavoIf: string[];
  // Bullet summary — 3-4 reasons the competitor is genuinely the right call
  pickCompetitorIf: string[];
};

export function ComparisonTable({ spec }: { spec: CompetitorSpec }) {
  return (
    <main id="main" className="bg-canvas">
      {/* HERO */}
      <section className="pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="container-page max-w-[920px]">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand">
            Comparison
          </p>
          <h1 className="mt-3 font-editorial text-[40px] md:text-[60px] font-medium tracking-[-0.025em] leading-[1.05] text-ink">
            Frugavo vs {spec.name}
          </h1>
          <p className="mt-4 text-[16px] text-ink-body italic">{spec.tagline}</p>
          <p className="mt-6 text-[17px] md:text-[18px] text-ink-body leading-relaxed max-w-[680px]">
            {spec.intro}
          </p>
        </div>
      </section>

      {/* COMPARISON TABLE — two layouts:
          • Mobile (<sm): each feature renders as a card with the
            two vendor values stacked vertically inside. Avoids the
            cramped 3-column grid at 390px.
          • Desktop (sm+): proper side-by-side feature matrix. */}
      <section className="pb-16 md:pb-24">
        <div className="container-page max-w-[920px]">

          {/* MOBILE LAYOUT */}
          <div className="sm:hidden space-y-3">
            {spec.rows.map((row) => (
              <div
                key={row.feature}
                className="rounded-2xl border border-hairline bg-white shadow-soft overflow-hidden"
              >
                <div className="px-4 py-3 bg-ink/[0.03] border-b border-hairline/60">
                  <div className="text-[14px] font-semibold text-ink leading-snug">
                    {row.feature}
                  </div>
                  {row.detail && (
                    <div className="mt-0.5 text-[12px] text-ink-body/85 leading-snug">
                      {row.detail}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 divide-x divide-hairline/60">
                  <div className="px-4 py-3.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-body/70">
                      {spec.name}
                    </div>
                    <div className="mt-2">
                      <InlineCell value={row.competitor} highlight={false} />
                    </div>
                  </div>
                  <div className="px-4 py-3.5 bg-brand/[0.04]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand">
                      Frugavo
                    </div>
                    <div className="mt-2">
                      <InlineCell value={row.frugavo} highlight={true} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP LAYOUT */}
          <div className="hidden sm:block rounded-3xl overflow-hidden border border-hairline bg-white shadow-soft">
            {/* Table header */}
            <div className="grid grid-cols-[1.4fr_1fr_1fr] bg-ink/[0.03] border-b border-hairline">
              <div className="px-4 md:px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-body">
                Feature
              </div>
              <div className="px-3 md:px-5 py-4 text-center">
                <div className="font-display text-[15px] md:text-[17px] font-bold text-ink">
                  {spec.name}
                </div>
              </div>
              <div className="px-3 md:px-5 py-4 text-center bg-brand/[0.06]">
                <div className="font-display text-[15px] md:text-[17px] font-bold text-brand">
                  Frugavo
                </div>
              </div>
            </div>

            {/* Rows */}
            {spec.rows.map((row, i) => (
              <div
                key={row.feature}
                className={
                  "grid grid-cols-[1.4fr_1fr_1fr] border-b border-hairline/60 last:border-b-0 " +
                  (i % 2 === 0 ? "bg-white" : "bg-ink/[0.015]")
                }
              >
                <div className="px-4 md:px-6 py-4">
                  <div className="text-[13.5px] md:text-[14.5px] font-semibold text-ink leading-snug">
                    {row.feature}
                  </div>
                  {row.detail && (
                    <div className="mt-0.5 text-[12px] text-ink-body/85 leading-snug">
                      {row.detail}
                    </div>
                  )}
                </div>
                <Cell value={row.competitor} highlight={false} />
                <Cell value={row.frugavo} highlight={true} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHICH TO PICK */}
      <section className="pb-16 md:pb-24">
        <div className="container-page max-w-[920px]">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-white border border-hairline p-6 md:p-7">
              <h2 className="font-display text-[18px] md:text-[20px] font-bold text-ink">
                Pick {spec.name} if…
              </h2>
              <ul className="mt-3 space-y-2.5">
                {spec.pickCompetitorIf.map((s) => (
                  <li key={s} className="flex items-start gap-2.5 text-[14px] text-ink-body leading-relaxed">
                    <span aria-hidden="true" className="text-ink-body/50 mt-1">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white border border-brand/30 ring-1 ring-brand/15 shadow-soft p-6 md:p-7">
              <h2 className="font-display text-[18px] md:text-[20px] font-bold text-brand">
                Pick Frugavo if…
              </h2>
              <ul className="mt-3 space-y-2.5">
                {spec.pickFrugavoIf.map((s) => (
                  <li key={s} className="flex items-start gap-2.5 text-[14px] text-ink-body leading-relaxed">
                    <Check size={15} strokeWidth={2.5} className="text-brand mt-0.5 shrink-0" aria-hidden />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="container-page max-w-[680px] text-center">
          <h2 className="font-display text-[28px] md:text-[36px] font-bold tracking-[-0.02em] leading-[1.1] text-ink">
            Try Frugavo free in 60 seconds.
          </h2>
          <p className="mt-4 text-[16px] text-ink-body">
            Link your accounts, see every recurring charge, decide what to keep. $0 forever for the basics.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="/sign-up">Get started free</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="/sample">See a sample report</a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

// Mobile inline cell — same kind logic as Cell but renders inline
// next to the vendor label, not in a centered table cell.
function InlineCell({ value, highlight }: { value: CellValue; highlight: boolean }) {
  if (value.kind === "check") {
    return (
      <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${highlight ? "bg-brand text-white" : "bg-ink/10 text-ink-body"}`}>
          <Check size={11} strokeWidth={3} aria-label="Yes" />
        </span>
        <span className={highlight ? "text-ink" : "text-ink-body"}>Yes</span>
      </div>
    );
  }
  if (value.kind === "x") {
    return (
      <div className="inline-flex items-center gap-1.5 text-[13px] text-ink-body/70">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink/[0.08]">
          <X size={11} strokeWidth={3} aria-label="No" />
        </span>
        <span>No</span>
      </div>
    );
  }
  if (value.kind === "dash") {
    return (
      <div className="inline-flex items-center gap-1.5 text-[13px] text-ink-body/60">
        <Minus size={14} aria-hidden /> N/A
      </div>
    );
  }
  return (
    <div className={`text-[13px] leading-snug ${highlight ? "text-ink font-medium" : "text-ink-body"}`}>
      {value.value}
    </div>
  );
}

function Cell({ value, highlight }: { value: CellValue; highlight: boolean }) {
  const bg = highlight ? "bg-brand/[0.04]" : "";
  if (value.kind === "check") {
    return (
      <div className={`px-3 md:px-5 py-4 flex items-center justify-center ${bg}`}>
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${highlight ? "bg-brand text-white" : "bg-ink/[0.08] text-ink-body"}`}>
          <Check size={13} strokeWidth={3} aria-label="Yes" />
        </span>
      </div>
    );
  }
  if (value.kind === "x") {
    return (
      <div className={`px-3 md:px-5 py-4 flex items-center justify-center ${bg}`}>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ink/[0.06] text-ink-body/70">
          <X size={13} strokeWidth={3} aria-label="No" />
        </span>
      </div>
    );
  }
  if (value.kind === "dash") {
    return (
      <div className={`px-3 md:px-5 py-4 flex items-center justify-center ${bg}`}>
        <Minus size={16} className="text-ink-body/40" aria-hidden />
      </div>
    );
  }
  return (
    <div className={`px-3 md:px-5 py-4 text-center text-[13px] md:text-[13.5px] ${highlight ? "text-ink font-medium " + bg : "text-ink-body"}`}>
      {value.value}
    </div>
  );
}
