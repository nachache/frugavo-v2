// DecisionStrip — top-of-dashboard prompt row that frames Frugavo as
// a decision engine rather than a static report.
//
// Four cells, each one-line. Numbers are REAL — derived from the
// canonical buildDashboardData payload. When a cell has no signal
// (e.g. no price increases this period), it renders a neutral
// "Nothing changed" line so the strip's rhythm isn't broken.
//
// Each cell is a Link that scrolls to or filters the ActionCenter
// below. The strip is purely a navigational primer — it doesn't
// duplicate the data, it points the user at the question to answer
// first.
//
// Visual language: same surface card rhythm as the rest of the
// dashboard. No emerald saturation, no insurance framing.

import Link from "next/link";
import { TrendingUp, AlertCircle, Layers, Scissors } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Props = {
  worthALookCount: number;
  worthALookYearlyCents: number;
  priceIncreaseCount: number;
  overlapCount: number;
  newSinceLastWeekCount: number;
};

function fmt(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function DecisionStrip({
  worthALookCount,
  worthALookYearlyCents,
  priceIncreaseCount,
  overlapCount,
  newSinceLastWeekCount,
}: Props) {
  const cells: Cell[] = [
    {
      icon: Scissors,
      label: "Worth cancelling",
      detail:
        worthALookCount > 0
          ? `${worthALookCount} could save ${fmt(worthALookYearlyCents)}/yr`
          : "Nothing flagged",
      href: "#action-center",
      active: worthALookCount > 0,
    },
    {
      icon: TrendingUp,
      label: "Increased",
      detail:
        priceIncreaseCount > 0
          ? `${priceIncreaseCount} price ${priceIncreaseCount === 1 ? "hike" : "hikes"}`
          : "No recent hikes",
      href: "#action-center",
      active: priceIncreaseCount > 0,
    },
    {
      icon: Layers,
      label: "Overlap",
      detail:
        overlapCount > 0
          ? `${overlapCount} possible ${overlapCount === 1 ? "duplicate" : "duplicates"}`
          : "No overlaps found",
      href: "#action-center",
      active: overlapCount > 0,
    },
    {
      icon: AlertCircle,
      label: "New this week",
      detail:
        newSinceLastWeekCount > 0
          ? `${newSinceLastWeekCount} new ${newSinceLastWeekCount === 1 ? "charge" : "charges"}`
          : "Nothing new",
      href: "#action-center",
      active: newSinceLastWeekCount > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
      {cells.map((c) => (
        <DecisionCell key={c.label} {...c} />
      ))}
    </div>
  );
}

type Cell = {
  icon: LucideIcon;
  label: string;
  detail: string;
  href: string;
  active: boolean;
};

function DecisionCell({ icon: Icon, label, detail, href, active }: Cell) {
  return (
    <Link
      href={href}
      className={
        "group rounded-2xl border bg-surface p-3.5 md:p-4 transition hover:bg-ink/[0.02] " +
        (active
          ? "border-hairline"
          : "border-hairline/60")
      }
    >
      <div className="flex items-center gap-2 text-[11.5px] md:text-[12px] uppercase tracking-[0.08em] text-ink-muted">
        <Icon
          size={12}
          strokeWidth={2.2}
          className={active ? "text-ink" : "text-ink-muted"}
        />
        {label}
      </div>
      <div
        className={
          "mt-1.5 text-[13.5px] md:text-[14px] leading-snug " +
          (active ? "font-medium text-ink" : "text-ink-muted")
        }
      >
        {detail}
      </div>
    </Link>
  );
}
