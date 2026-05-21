import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Recommendation } from "@/lib/recommendations";

// Single calm banner that sits above the dashboard hero. Never shown if
// nextRecommendation returns null — silence is the goal.

const KIND_STYLE: Record<
  Recommendation["kind"],
  { bg: string; icon: string; iconBg: string }
> = {
  failed_cancellation: {
    bg: "linear-gradient(180deg, #FB71851A 0%, transparent 100%)",
    icon: "#FB7185",
    iconBg: "#FB71851A",
  },
  review_candidates: {
    bg: "linear-gradient(180deg, #F59E0B14 0%, transparent 100%)",
    icon: "#B45309",
    iconBg: "#F59E0B1A",
  },
  silent_sub: {
    bg: "linear-gradient(180deg, #94A3B81A 0%, transparent 100%)",
    icon: "#475569",
    iconBg: "#94A3B81A",
  },
  renewal_window: {
    bg: "linear-gradient(180deg, #6366F114 0%, transparent 100%)",
    icon: "#4338CA",
    iconBg: "#6366F11A",
  },
  first_scan_done: {
    bg: "linear-gradient(180deg, #10B98114 0%, transparent 100%)",
    icon: "#047857",
    iconBg: "#10B9811A",
  },
};

export function RecommendationBanner({ rec }: { rec: Recommendation | null }) {
  if (!rec) return null;
  const style = KIND_STYLE[rec.kind];

  return (
    <div
      className="rounded-2xl px-5 py-4 flex items-start gap-4 mb-6 border border-hairline/60"
      style={{ background: style.bg }}
    >
      <div
        className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-xl"
        style={{ background: style.iconBg }}
      >
        <Sparkles size={16} style={{ color: style.icon }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-semibold text-ink">
          {rec.headline}
        </div>
        <div className="text-[12.5px] text-ink-body leading-relaxed mt-0.5">
          {rec.body}
        </div>
      </div>
      {rec.cta && (
        <Link
          href={rec.cta.href}
          className="hidden sm:inline-flex h-9 items-center gap-1 rounded-full bg-ink px-4 text-[12.5px] font-medium text-white hover:bg-ink/85 transition shrink-0"
        >
          {rec.cta.label}
          <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}
