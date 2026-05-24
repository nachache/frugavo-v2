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
  Binoculars,
  Clock,
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

      {/* ONE PROMINENT STAT — the metric that justifies the price.
          Per critic: 4 boxes competing for attention diluted the
          signal. 'Charges checked' was backend noise; 'Watching N
          possible charges' confused users next to the sub count.
          Both deleted. Surprises:0 moves to a footer line under the
          feed (still present, no longer the visual climax). */}
      <div className="px-5 md:px-6 pb-5 md:pb-6">
        <div className="rounded-xl bg-canvas/40 border border-hairline/60 px-4 py-4 md:px-5 md:py-5">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted leading-tight">
            Caught this month
          </div>
          <div className="mt-1.5 font-display font-bold text-[34px] md:text-[40px] leading-none tabular-nums text-brand">
            {fmtRound(data.stats.caught_this_month_cents)}
          </div>
          <div className="mt-1.5 text-[12.5px] md:text-[13px] text-ink-body">
            {data.stats.caught_this_month_events > 0
              ? `across ${data.stats.caught_this_month_events} event${data.stats.caught_this_month_events === 1 ? "" : "s"} you took action on`
              : "you took action on"}
          </div>
          {data.stats.flagged_this_month_cents > 0 && (
            <div className="mt-2 text-[12px] text-ink-muted">
              + {fmtRound(data.stats.flagged_this_month_cents)} flagged for
              your review.{" "}
              <span className="text-ink-muted/70">
                (Not counted until you act.)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* FEED — what we did for you */}
      <div className="px-5 md:px-6 pb-5 md:pb-6 border-t border-hairline pt-5 md:pt-6">
        <div className="text-[12px] md:text-[13px] font-semibold text-ink mb-3">
          What we did for you
        </div>
        {hasEvents ? (
          <>
            <ul className="space-y-3">
              {data.recent_actions.map((a) => (
                <ActionRow key={a.id} action={a} />
              ))}
            </ul>
            {/* Quiet-flex footer — the 'we caught nothing because nothing
                slipped past' line. Was a top-level stat box; demoted
                here per critic. Only renders when surprises === 0
                (when non-zero it'd appear as an alert in the feed). */}
            {data.stats.surprises_count === 0 &&
              data.since_signup.days_protected > 0 && (
                <div className="mt-4 text-[11.5px] md:text-[12px] text-ink-muted">
                  0 surprises slipped past us in{" "}
                  {data.since_signup.days_protected} day
                  {data.since_signup.days_protected === 1 ? "" : "s"}.
                </div>
              )}
          </>
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

      {/* WATCHING — upcoming charges + flagged items. Lets the user
          act before the charge hits (cancel before renewal, confirm
          a missing one). Hidden when the watchdog isn't currently
          tracking any near-term events. */}
      {data.watching.length > 0 && (
        <div className="px-5 md:px-6 pb-5 md:pb-6 border-t border-hairline pt-5 md:pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Binoculars
              size={14}
              strokeWidth={2.2}
              className="text-brand"
              aria-hidden="true"
            />
            <div className="text-[12px] md:text-[13px] font-semibold text-ink">
              What we&apos;re watching for you
            </div>
          </div>
          <ul className="space-y-2.5">
            {data.watching.map((w) => (
              <WatchingRow key={w.id} item={w} />
            ))}
          </ul>
        </div>
      )}

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

function WatchingRow({
  item,
}: {
  item: ProtectionPanelData["watching"][number];
}) {
  const reasonLabel =
    item.reason === "missing_renewal"
      ? "Missing renewal"
      : item.reason === "trial_converting"
        ? "Trial converting"
        : item.reason === "renewal_upcoming"
          ? "Upcoming renewal"
          : item.reason === "new_subscription"
            ? "New charge"
            : "Watching";
  return (
    <li className="flex items-center gap-3">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand/12 text-brand shrink-0">
        <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13.5px] md:text-[14px] font-medium text-ink truncate">
            {item.merchant_name}
          </span>
          <span className="text-[11px] md:text-[12px] text-ink-muted">
            · {reasonLabel}
          </span>
        </div>
        <div className="mt-0.5 text-[12px] md:text-[13px] text-ink-muted">
          {item.when_label}
          {item.amount_cents != null && item.amount_cents > 0 && (
            <span className="tabular-nums">
              {" "}· ${(item.amount_cents / 100).toFixed(2)}
            </span>
          )}
        </div>
      </div>
      {item.subscription_id && (
        <a
          href={`/app/subscriptions/${item.subscription_id}`}
          className="text-[11.5px] md:text-[12px] font-medium text-brand hover:text-brand-hover transition shrink-0"
        >
          Cancel?
        </a>
      )}
    </li>
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
