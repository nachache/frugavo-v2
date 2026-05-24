"use client";

// ProtectionPanel — the redesigned Peace of Mind surface.
//
// Replaces the old ProtectionCoverageCard. The brief: make silent
// vigilance VISIBLE without making it noisy. Sells the paid product
// by showing the work done, not by promising safety.
//
// Layout:
//   ┌────────────────────────────────────────────────────────────┐
//   │ Peace of Mind — active · watching      Guarding $X/mo      │
//   │ We're tracking N recurring charges so you don't have to.   │
//   ├────────────────────────────────────────────────────────────┤
//   │  [ Caught $X ]  [ Checked N ]  [ Watching N ]  [ Surprises 0 ] │
//   ├────────────────────────────────────────────────────────────┤
//   │  What we did for you                                       │
//   │  ⟲ Stopped a trial — ExpressVPN saved $99 ............ 2d │
//   │  ↑ Flagged a price hike — Netflix $20.49 → $22.99 .... 6d │
//   │  □ Caught a duplicate — Two Spotify plans ............ 12d │
//   │  👁 Watching — Apple iCloud confirming the pattern .... now│
//   ├────────────────────────────────────────────────────────────┤
//   │  [Review the watch list ↗]  [See everything caught ↗]      │
//   └────────────────────────────────────────────────────────────┘
//
// Honesty principles baked into the labels:
//   - "Caught this month" only counts confirmed user actions
//     (cancels). Flagged price hikes appear as a separate line.
//   - Verbs are precise: STOPPED (trial before charge), FLAGGED
//     (price/anomaly surfaced), CAUGHT (new sub or duplicate),
//     WATCHING (uncertain, being confirmed), PRUNED (user cancelled).
//   - Empty months never look dead — we lead with cumulative
//     "$X total caught since you joined" + "0 surprises slipped past".

import Link from "next/link";
import {
  Shield,
  CornerDownLeft,
  TrendingUp,
  Copy,
  Eye,
  Scissors,
  AlertCircle,
} from "lucide-react";
import type { ProtectionPanelData, PanelVerb } from "@/lib/protection/panel";

type Props = {
  data: ProtectionPanelData;
  // 'active' shows the full panel + status pill. 'inactive' shows a
  // soft pitch — same layout, sample data, locked CTAs.
  state: "active" | "inactive";
};

function fmtRound(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
}

export function ProtectionPanel({ data, state }: Props) {
  const isActive = state === "active";
  const hasEvents = data.recent_actions.length > 0;

  return (
    <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
      {/* HERO — what we're guarding */}
      <div className="p-5 md:p-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand/15 shrink-0">
            <Shield size={18} className="text-brand" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-[18px] md:text-[20px] font-bold text-ink leading-tight">
                Peace of Mind — {isActive ? "active" : "preview"}
              </h2>
              {isActive && (
                <span className="inline-flex items-center gap-1.5 text-[11px] md:text-[12px] font-medium text-brand">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 inline-flex h-2 w-2 rounded-full bg-brand opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
                  </span>
                  watching
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] md:text-[14px] text-ink-body leading-snug">
              We&apos;re tracking{" "}
              <span className="font-medium text-ink">
                {data.guarding.charges_count} recurring charge
                {data.guarding.charges_count === 1 ? "" : "s"}
              </span>{" "}
              so you don&apos;t have to.
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Guarding
          </div>
          <div className="mt-0.5 font-display text-[22px] md:text-[28px] font-bold text-ink tabular-nums leading-none">
            {fmtRound(data.guarding.monthly_cents)}
            <span className="text-[14px] md:text-[16px] font-medium text-ink-muted">
              /mo
            </span>
          </div>
        </div>
      </div>

      {/* STATS GRID — 4 boxes */}
      <div className="px-5 md:px-6 pb-5 md:pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
          <StatBox
            label="Caught this month"
            value={fmtRound(data.stats.caught_this_month_cents)}
            sub={
              data.stats.caught_this_month_events > 0
                ? `across ${data.stats.caught_this_month_events} event${data.stats.caught_this_month_events === 1 ? "" : "s"}`
                : "you took action on"
            }
            valueColor="text-brand"
          />
          <StatBox
            label="Charges checked"
            value={data.stats.charges_checked_total.toLocaleString("en-US")}
            sub={
              data.since_signup.user_since_iso
                ? `since ${new Date(data.since_signup.user_since_iso).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                : "since you joined"
            }
          />
          <StatBox
            label="Watching"
            value={data.stats.watching_count.toString()}
            sub={`possible charge${data.stats.watching_count === 1 ? "" : "s"}`}
            valueColor={data.stats.watching_count > 0 ? "text-amber-600" : "text-ink"}
          />
          <StatBox
            label="Surprises"
            value={data.stats.surprises_count.toString()}
            sub="slipped past us"
            valueColor={data.stats.surprises_count === 0 ? "text-ink" : "text-danger"}
          />
        </div>
        {data.stats.flagged_this_month_cents > 0 && (
          <div className="mt-3 text-[11.5px] md:text-[12px] text-ink-muted">
            + {fmtRound(data.stats.flagged_this_month_cents)} flagged for
            your review.{" "}
            <span className="text-ink-muted/70">
              (Not counted in &quot;caught&quot; until you act.)
            </span>
          </div>
        )}
      </div>

      {/* FEED — what we did for you */}
      <div className="px-5 md:px-6 pb-5 md:pb-6 border-t border-hairline pt-5 md:pt-6">
        <div className="text-[12px] md:text-[13px] font-semibold text-ink mb-3">
          What we did for you
        </div>
        {hasEvents ? (
          <ul className="space-y-3">
            {data.recent_actions.map((a) => (
              <ActionRow key={a.id} action={a} />
            ))}
          </ul>
        ) : (
          // Empty / quiet-month state per the design caution: never
          // look dead. Lead with cumulative + 0-surprises framing.
          <div className="rounded-xl bg-canvas/40 border border-hairline/60 p-4">
            <div className="text-[13px] text-ink font-medium">
              Nothing to flag this month — that&apos;s the point.
            </div>
            <div className="mt-1 text-[12.5px] text-ink-body leading-relaxed">
              {data.since_signup.total_events > 0 ? (
                <>
                  Since you joined, we&apos;ve caught{" "}
                  <span className="font-medium text-ink">
                    {fmtRound(data.since_signup.total_caught_cents)}
                  </span>{" "}
                  across {data.since_signup.total_events} event
                  {data.since_signup.total_events === 1 ? "" : "s"}, and{" "}
                  <span className="font-medium text-ink">
                    {data.stats.surprises_count}
                  </span>{" "}
                  surprises have slipped past us in{" "}
                  {data.since_signup.days_protected} days.
                </>
              ) : (
                <>
                  We&apos;ve been watching{" "}
                  <span className="font-medium text-ink">
                    {data.guarding.charges_count}
                  </span>{" "}
                  charges for {data.since_signup.days_protected} days. Zero
                  surprises so far.
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="grid grid-cols-1 md:grid-cols-2 border-t border-hairline">
        <CtaButton
          href="/app?tab=subscriptions"
          label="Review the watch list"
        />
        <CtaButton
          href="/app/alerts"
          label="See everything caught"
          rightBorder
        />
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function StatBox({
  label,
  value,
  sub,
  valueColor = "text-ink",
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl bg-canvas/40 border border-hairline/60 px-3.5 py-3 md:px-4 md:py-3.5">
      <div className="text-[10.5px] md:text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted leading-tight">
        {label}
      </div>
      <div
        className={[
          "mt-1.5 font-display font-bold text-[22px] md:text-[26px] leading-none tabular-nums",
          valueColor,
        ].join(" ")}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] md:text-[12px] text-ink-muted leading-snug">
        {sub}
      </div>
    </div>
  );
}

function ActionRow({ action }: { action: ProtectionPanelData["recent_actions"][number] }) {
  return (
    <li className="flex items-start gap-3">
      <VerbIcon verb={action.verb} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] md:text-[14px] font-medium text-ink leading-snug">
          {action.title}
        </div>
        <div className="mt-0.5 text-[12px] md:text-[13px] text-ink-muted leading-snug">
          {action.detail}
        </div>
      </div>
      <div className="text-[11px] md:text-[12px] text-ink-muted tabular-nums shrink-0 mt-0.5">
        {timeAgo(action.when)}
      </div>
    </li>
  );
}

function VerbIcon({ verb }: { verb: PanelVerb }) {
  const base =
    "inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0";
  switch (verb) {
    case "stopped":
      return (
        <span className={`${base} bg-brand/15 text-brand`}>
          <CornerDownLeft size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      );
    case "flagged":
      return (
        <span className={`${base} bg-amber-100 text-amber-700`}>
          <TrendingUp size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      );
    case "caught":
      return (
        <span className={`${base} bg-blue-100 text-blue-700`}>
          <Copy size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      );
    case "watching":
      return (
        <span className={`${base} bg-violet-100 text-violet-700`}>
          <Eye size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      );
    case "pruned":
      return (
        <span className={`${base} bg-rose-100 text-rose-700`}>
          <Scissors size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      );
    default:
      return (
        <span className={`${base} bg-ink/[0.06] text-ink-muted`}>
          <AlertCircle size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      );
  }
}

function CtaButton({
  href,
  label,
  rightBorder,
}: {
  href: string;
  label: string;
  rightBorder?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center justify-center gap-1.5 py-4 text-[13px] md:text-[14px] font-medium text-ink hover:bg-ink/[0.03] transition",
        rightBorder ? "md:border-l border-hairline" : "",
      ].join(" ")}
    >
      {label}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    </Link>
  );
}
