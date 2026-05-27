// SharePanel — moved off the main dashboard per IA refactor.
//
// Identity card preview (left) + share controls (right) at the top.
// Below: a row of all the exportable share cards (Wrapped, Monthly
// burn, Yearly spend, AI stack) each with their own social-logo
// share row.
//
// Server component — embeds the client ShareButtons component for
// the actual sharing primitives.

import { ShareButtons } from "./share-buttons";
import type { Personality } from "@/lib/personality";

type Props = {
  monthlySubCents: number;
  yearlySubCents: number;
  totalActiveCount: number;
  aiMonthlyCents: number;
  aiCount: number;
  personality: Personality;
  // True when the dashboard payload has confirmed subscriptions. When
  // false (fresh signup, Plaid still pulling, or user rejected
  // everything), we render a skeleton instead of the empty "$0/mo /
  // Quietly Watching" card so the share surface never disagrees with
  // the dashboard state.
  hasData: boolean;
};

function fmt(c: number, opts: { withCents?: boolean } = {}): string {
  const v = c / 100;
  if (opts.withCents === false) return `$${Math.round(v).toLocaleString("en-US")}`;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SharePanel({
  monthlySubCents,
  yearlySubCents,
  totalActiveCount,
  aiMonthlyCents,
  aiCount,
  personality,
  hasData,
}: Props) {
  // Hard guard. If the dashboard payload has no confirmed
  // subscriptions, the SVG route returns 204 and we render the
  // skeleton instead of the live cards. This is what prevents the
  // "share card shows $0 while dashboard shows real numbers" trust
  // break — there is no path where one renders and the other doesn't.
  if (!hasData) {
    return <SharePanelSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Identity card hero */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7">
        <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
          Your identity card
        </div>
        <div className="mt-1 text-[13px] text-ink-body mb-4">
          A snapshot of your subscription self. The image — not a link —
          gets shared.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-center">
          <a
            href="/api/share-card/identity"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl overflow-hidden border border-hairline bg-ink transition hover:opacity-95"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/share-card/identity"
              alt="Your subscription identity card"
              className="w-full h-auto block"
              loading="eager"
            />
          </a>
          <div className="space-y-4">
            <div>
              <div className="font-display text-[22px] md:text-[26px] font-bold tracking-[-0.02em] text-ink leading-tight">
                {personality.label}
              </div>
              <div className="mt-1 text-[14px] text-ink-body">
                {personality.sub}
              </div>
            </div>
            <ShareButtons
              shareType="identity"
              shareText={`I'm "${personality.label}" — ${fmt(monthlySubCents, { withCents: false })}/mo on subscriptions.`}
            />
          </div>
        </div>
      </div>

      {/* More share cards */}
      <div>
        <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-3">
          More cards
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <ShareThumb
            type="wrapped"
            label="My year wrapped"
            aspect="portrait"
            shareText={`My subscription year: ${fmt(yearlySubCents, { withCents: false })} across ${totalActiveCount} subscriptions.`}
          />
          <ShareThumb
            type="monthly_burn"
            label="Monthly burn"
            shareText={`I spend ${fmt(monthlySubCents, { withCents: false })}/mo on subscriptions.`}
          />
          <ShareThumb
            type="yearly_total"
            label="Yearly spend"
            shareText={`I've spent ${fmt(yearlySubCents, { withCents: false })} on subscriptions this year.`}
          />
          {aiCount > 0 && (
            <ShareThumb
              type="ai_stack"
              label="AI stack"
              shareText={`My AI stack costs ${fmt(aiMonthlyCents, { withCents: false })}/mo.`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Skeleton — rendered when the dashboard payload has no confirmed
// subscriptions yet. Tells the truth ("your card will be ready after
// the first scan") instead of rendering a default $0 / "Quietly
// Watching" card that would directly contradict an empty dashboard.
// Same outer rhythm as the populated panel so the layout doesn't jump
// when data arrives and the user navigates back.
function SharePanelSkeleton() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7">
        <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
          Your identity card
        </div>
        <div className="mt-1 text-[13px] text-ink-body mb-4">
          We&apos;ll generate your card once your first scan finishes. No
          numbers before then — they&apos;d be wrong.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-center">
          <div className="rounded-2xl overflow-hidden border border-hairline bg-ink/[0.04] aspect-[1080/1350] flex items-center justify-center">
            <div className="text-[13px] text-ink-muted">
              Waiting for your data
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-6 w-3/5 rounded-md bg-ink/[0.06] animate-pulse" />
            <div className="h-4 w-4/5 rounded-md bg-ink/[0.05] animate-pulse" />
            <div className="h-4 w-2/5 rounded-md bg-ink/[0.05] animate-pulse" />
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-3">
          More cards
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-hairline bg-surface overflow-hidden"
            >
              <div className="aspect-square bg-ink/[0.04]" />
              <div className="px-4 py-3">
                <div className="h-4 w-2/3 rounded-md bg-ink/[0.06] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShareThumb({
  type,
  label,
  shareText,
  aspect = "square",
}: {
  type: string;
  label: string;
  shareText: string;
  aspect?: "square" | "portrait";
}) {
  const aspectCls = aspect === "portrait" ? "aspect-[9/16]" : "aspect-square";
  return (
    <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
      <a
        href={`/api/share-card/${type}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`block ${aspectCls} bg-ink relative overflow-hidden`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/share-card/${type}`}
          alt={`${label} share card`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </a>
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="text-[13px] md:text-[14px] font-medium text-ink truncate">
          {label}
        </div>
        <ShareButtons shareType={type} shareText={shareText} compact />
      </div>
    </div>
  );
}
