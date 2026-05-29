// IdentityHero — first card on the dashboard.
//
// Layout: vertical stack (image at top, personality + sub in the
// middle, share toggle at the bottom). The 5-social-icon row used
// to live inline; per dashboard critic it read like "CTA shotgun."
// Now it's a single 'Share' button that expands to the full picker
// on click — same primitives, less visual noise.

"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareButtons } from "./share-buttons";
import type { Personality } from "@/lib/personality";
import type { HealthScore } from "@/lib/intelligence/health-score";

type Props = {
  monthlySubCents: number;
  // Active confirmed subscription count — drives the live numbers
  // strip below the personality copy. Updates every router.refresh
  // so the user sees the card respond to every Keep / Not a sub
  // action in real time.
  subCount: number;
  personality: Personality;
  // Public profile slug. When present, ShareButtons attaches the
  // canonical /u/<slug> URL to navigator.share so social platforms
  // unfurl the right personalized OG preview. May be null on the
  // very first dashboard render before the slug is provisioned.
  publicSlug?: string | null;
  // First name from Clerk for warmer mobile framing ("Hey Nabil —
  // you're the Wellness Devotee."). Falls back to a generic
  // greeting when null.
  firstName?: string | null;
  // True when the dashboard payload has confirmed subscriptions. The
  // /api/share-card/identity SVG returns 204 when this is false so
  // the <img> below would render a broken icon. We render a
  // skeleton instead — single rule across SharePanel + IdentityHero
  // so the two surfaces can never disagree.
  hasData: boolean;
  // Subscription Health Score (300..850). Renders as a small pill
  // under the live numbers strip when present. Methodology lives in
  // lib/intelligence/health-score.ts.
  healthScore?: HealthScore | null;
};

function fmt(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

export function IdentityHero({
  monthlySubCents,
  subCount,
  personality,
  publicSlug,
  firstName,
  hasData,
  healthScore,
}: Props) {
  const greeting = firstName ? `Hey ${firstName} —` : "Here's your card —";
  const [shareOpen, setShareOpen] = useState(false);

  // Hard guard. If the dashboard payload has zero confirmed
  // subscriptions, /api/share-card/identity will respond 204 and the
  // <img> below would render as a broken icon. The personality
  // selector also returns "Quietly Watching · $0/mo" in that state,
  // which directly contradicts the rest of the page. Show a
  // skeleton instead — only path where this surface renders numbers
  // is when there ARE numbers to render.
  if (!hasData) {
    return <IdentityHeroSkeleton greeting={greeting} firstName={firstName} />;
  }

  return (
    // Reduced outer padding (was p-4 md:p-6 → p-3 md:p-4) and removed
    // the card's max-width cap. The SVG card now fills its column so
    // the SVG fonts inside aren't shrunk into illegibility on desktop.
    <div className="card-window rounded-2xl border border-hairline bg-surface p-3 md:p-4 animate-fadeUp overflow-hidden h-full flex flex-col">
      {/* Identity SVG preview — full width of the column for desktop
          readability. The card still maintains its aspect ratio so it
          looks the same at any width. */}
      <a
        href="/api/share-card/identity"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl overflow-hidden border border-hairline bg-ink transition hover:opacity-95 w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/share-card/identity"
          alt="Your subscription identity card"
          className="w-full h-auto block"
          loading="eager"
        />
      </a>

      {/* Personality label + sub. Slightly bigger headlines on
          desktop so the card and the prose feel balanced. */}
      <div className="mt-5 md:mt-7 text-center md:text-left px-1 md:px-2">
        <div className="text-[13px] md:text-[14px] font-medium text-ink-muted">
          {greeting}
        </div>
        {/* Personality labels already lead with "The " (e.g. "The
            Streaming Collector"). Previously we wrote "you're the"
            ahead of the span which produced "you're the The …" —
            critic flagged the double article. Drop the leading
            "you're the" and let the label stand on its own. */}
        <div className="mt-1.5 font-display text-[28px] sm:text-[32px] md:text-[38px] font-bold tracking-[-0.02em] text-ink leading-[1.08]">
          You&apos;re
          <br />
          <span className="text-brand">{personality.label}</span>.
        </div>
        <div className="mt-3 text-[15px] md:text-[16.5px] text-ink-body leading-relaxed">
          {personality.sub}
        </div>

        {/* Live numbers strip — ticks on every router.refresh after
            a Keep / Not a sub / cancel action. Gives the user
            visible proof the personality data is responding to
            their decisions, even when the archetype LABEL doesn't
            flip (category mix unchanged). */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-canvas/60 border border-hairline/60 px-3 py-1.5 text-[12.5px] md:text-[13px] text-ink-body tabular-nums">
          <span className="font-medium text-ink">
            {subCount.toLocaleString("en-US")}
          </span>
          <span className="text-ink-muted">
            confirmed {subCount === 1 ? "sub" : "subs"}
          </span>
          <span className="text-ink-muted/40">·</span>
          <span className="font-medium text-ink">{fmt(monthlySubCents)}</span>
          <span className="text-ink-muted">/mo</span>
        </div>

        {healthScore ? (
          <div className="mt-3">
            <HealthScorePill score={healthScore} />
            {/* Short interpretation — the score on its own is just a
                number; the one-line summary tells the user what it
                means right now (e.g. "Diversified, predictable
                monthly cost." or "2 subscriptions look forgotten"). */}
            <p className="mt-1.5 text-[12px] md:text-[12.5px] text-ink-muted leading-snug max-w-[420px]">
              {healthScore.summary}
            </p>
          </div>
        ) : null}
      </div>

      {/* Share — single button, expands to the picker on click.
          Wrapped in a soft canvas panel so it reads as a dedicated
          "share affordance" instead of a naked button sitting
          under the prose. Was bare; critic said the button looked
          like a label. The bg-canvas/40 wrapper gives it a clear
          home without competing with the personality copy. */}
      <div className="mt-5 md:mt-6">
        <div className="rounded-2xl bg-canvas/50 border border-hairline/60 px-4 py-3 md:px-5 md:py-4">
          {shareOpen ? (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[11.5px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                  Share your card
                </div>
                <button
                  type="button"
                  onClick={() => setShareOpen(false)}
                  className="text-[11.5px] text-ink-muted hover:text-ink transition"
                  aria-label="Close share options"
                >
                  Done
                </button>
              </div>
              <ShareButtons
                shareType="identity"
                shareText={`I'm "${personality.label}" — ${fmt(monthlySubCents)}/mo on recurring charges.`}
                shareSlug={publicSlug ?? null}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink text-canvas text-[13px] font-medium hover:bg-ink/85 transition w-full justify-center md:w-auto"
            >
              <Share2 size={14} strokeWidth={2.2} aria-hidden="true" />
              Share your card
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// HealthScorePill — credit-score-style 300..850 chip with a tiny
// inline progress fill. Tone is calm, observational. Tooltip exposes
// the per-factor breakdown for users who want to understand why.
function HealthScorePill({ score }: { score: HealthScore }) {
  const min = 300;
  const max = 850;
  const pct = Math.max(0, Math.min(1, (score.score - min) / (max - min)));
  const bandColor =
    score.band === "excellent" || score.band === "strong"
      ? "var(--color-brand, #10b981)"
      : score.band === "healthy"
        ? "var(--color-ink, #0f172a)"
        : score.band === "fair"
          ? "var(--color-amber, #f59e0b)"
          : "var(--color-danger, #dc2626)";
  const tooltip =
    `Diversification ${score.factors.diversification} · ` +
    `Stability ${score.factors.stability} · ` +
    `Engagement ${score.factors.engagement} · ` +
    `Recency ${score.factors.recencyDrift}`;
  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full bg-canvas/60 border border-hairline/60 px-3 py-1.5 text-[12.5px] md:text-[13px] tabular-nums"
      title={tooltip}
    >
      <span className="text-ink-muted">Health</span>
      <span className="font-medium text-ink">{score.score}</span>
      <span
        className="inline-block h-1.5 w-12 rounded-full bg-ink/10 overflow-hidden"
        aria-hidden="true"
      >
        <span
          className="block h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(pct * 100)}%`, background: bandColor }}
        />
      </span>
      <span className="text-ink-muted">{score.bandLabel}</span>
    </div>
  );
}

// Skeleton — rendered when the dashboard payload has zero confirmed
// subscriptions. Honest copy ("we'll generate your card once your
// first scan finishes") instead of a $0 / Quietly Watching card that
// would contradict the rest of the page. Same outer rhythm as the
// populated hero so the layout doesn't jump when data arrives.
function IdentityHeroSkeleton({
  greeting,
  firstName,
}: {
  greeting: string;
  firstName?: string | null;
}) {
  return (
    <div className="card-window rounded-2xl border border-hairline bg-surface p-3 md:p-4 animate-fadeUp overflow-hidden h-full flex flex-col">
      <div className="rounded-2xl overflow-hidden border border-hairline bg-ink/[0.04] aspect-[1080/1350] flex items-center justify-center">
        <div className="text-[13px] text-ink-muted px-6 text-center max-w-[280px]">
          Your card will be ready once your first scan finishes.
        </div>
      </div>

      <div className="mt-5 md:mt-7 text-center md:text-left px-1 md:px-2">
        <div className="text-[13px] md:text-[14px] font-medium text-ink-muted">
          {greeting}
        </div>
        <div className="mt-1.5 font-display text-[28px] sm:text-[32px] md:text-[38px] font-bold tracking-[-0.02em] text-ink leading-[1.08]">
          {firstName ? "We’re still" : "Still"}
          <br />
          <span className="text-brand">waiting on your bank</span>.
        </div>
        <div className="mt-3 text-[15px] md:text-[16.5px] text-ink-body leading-relaxed">
          The moment your transactions arrive we&apos;ll build your
          subscription identity. No fake numbers until then.
        </div>
      </div>

      <div className="mt-5 md:mt-6">
        <div className="rounded-2xl bg-canvas/50 border border-hairline/60 px-4 py-3 md:px-5 md:py-4">
          <div className="h-10 rounded-full bg-ink/[0.05] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
