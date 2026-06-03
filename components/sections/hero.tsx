"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HERO_VARIANTS,
  LANDING,
  type VariantKey,
} from "@/lib/landing/constants";
import { hero as legacyHero } from "@/lib/content";
import { HeroResultsPreview } from "@/components/sections/hero-results-preview";
import { PdfInterestCta } from "@/components/marketing/pdf-interest-cta";

// Hero — revision pass (R1–R6).
//
// Layout, mobile order:
//   1. Eyebrow badge
//   2. Editorial serif headline (Fraunces) with italic accent on the
//      key phrase "forgotten about"
//   3. ONE-line value statement (the $42/mo forgotten figure only —
//      $1,847/yr is removed from the hero per R2)
//   4. Primary CTA + Secondary "See a sample report" + lock badge
//   5. Single consolidated Plaid trust strip (replaces 4 checkmarks +
//      the duplicate Plaid mention from the previous version)
//   6. Bank-logo placeholder row + "+11,000 banks" caption
//   7. Static results preview (replaces the animated demo card)
//   8. Disconnect-anytime reassurance line
//
// Desktop: left column = items 1-6 + 8; right column = the preview.
//
// Trust copy reduced from four overlapping statements (read-only,
// never-store, powered by Plaid, Robinhood-Venmo security) to one
// consolidated line + one quiet Robinhood/Venmo caption. Plaid named
// exactly once. Every number reads from LANDING constants.

type HeroProps = {
  variant?: VariantKey;
  headlineOverride?: string | undefined;
};

// Headline splitter — applies Fraunces italic emphasis only to the
// word "forgot" when it appears in the headline. Matches both
// "forgot" (default headline: "Still paying for subscriptions you
// forgot?") AND "forgotten" (because the substring match starts at
// index 0 of either). Falls back to the full headline rendered in
// plain serif when neither appears (mint / cancel / find / competitor
// variants).
//
// Returns either:
//   { before: "…", emph: "…", after: "…" }  (split happened)
//   { before: full, emph: "", after: "" }    (no split)
const EMPH_PHRASE = "forgot";
function splitHeadline(text: string): { before: string; emph: string; after: string } {
  const idx = text.toLowerCase().indexOf(EMPH_PHRASE);
  if (idx === -1) return { before: text, emph: "", after: "" };
  return {
    before: text.slice(0, idx),
    emph: text.slice(idx, idx + EMPH_PHRASE.length),
    after: text.slice(idx + EMPH_PHRASE.length),
  };
}

export function Hero({ variant = "default", headlineOverride }: HeroProps) {
  const v = HERO_VARIANTS[variant] ?? HERO_VARIANTS.default;
  const headline = headlineOverride ?? v.headline;
  const subheadline = v.subheadline;
  const eyebrow = v.eyebrow ?? legacyHero.eyebrow;
  const { before, emph, after } = splitHeadline(headline);

  // Respect prefers-reduced-motion — every framer-motion animation
  // collapses to its end state in one frame.
  const reduce = useReducedMotion();
  const m = (base: Record<string, unknown>): Record<string, unknown> =>
    reduce ? { initial: false, animate: base.animate } : base;

  return (
    <section
      className="relative pt-10 md:pt-16 pb-16 md:pb-24 overflow-hidden"
      aria-labelledby="hero-headline"
    >
      {/* Drifting blob backdrop — emerald onto cream, very low opacity. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 -right-20 h-[640px] w-[640px] rounded-full bg-gradient-to-br from-emerald-200/40 via-emerald-100/30 to-transparent blur-3xl animate-blob" />
        <div className="absolute top-[20%] -left-32 h-[480px] w-[480px] rounded-full bg-gradient-to-br from-amber-100/30 to-transparent blur-3xl animate-blob [animation-delay:-8s]" />
      </div>

      <div className="container-page grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-start">
        {/* LEFT */}
        <div className="max-w-[640px]">
          {/* 1. Eyebrow badge */}
          <motion.div
            {...m({
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
            })}
          >
            <Badge tone="brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {eyebrow}
            </Badge>
          </motion.div>

          {/* 2. Editorial headline — Fraunces serif. Italic accent
              applied only to the "forgotten about" phrase when present
              (default variant). Other variants render the full
              headline in Fraunces regular. Tracking pulled in tight
              for editorial serif character. */}
          <motion.h1
            id="hero-headline"
            {...m({
              initial: { opacity: 0, y: 18 },
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: 0.6,
                delay: 0.06,
                ease: [0.16, 1, 0.3, 1],
              },
            })}
            className="mt-6 font-editorial text-ink text-[36px] md:text-[54px] leading-[1.04] tracking-[-0.02em] font-medium"
          >
            {emph ? (
              <>
                {before}
                <em className="font-editorial italic font-medium">{emph}</em>
                {after}
              </>
            ) : (
              headline
            )}
          </motion.h1>

          {/* 3. One-line value — the $42/mo forgotten figure ONLY.
              $1,847/yr no longer appears in the hero (R2). Per-variant
              subhead from constants — most variants already contain
              the $42 figure; if a future variant strips it, the page
              still leads with a single-number promise. */}
          <motion.p
            {...m({
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: 0.55,
                delay: 0.12,
                ease: [0.16, 1, 0.3, 1],
              },
            })}
            className="mt-5 max-w-[540px] text-[16.5px] md:text-[18.5px] leading-relaxed text-ink-body"
          >
            {subheadline}
          </motion.p>

          {/* 4. CTA pair — moved ABOVE the trust strip so the primary
              action is reachable above the fold on mobile (R6). Lock
              badge sits directly under to put a trust cue at the
              moment of the ask. */}
          <motion.div
            {...m({
              initial: { opacity: 0, y: 14 },
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: 0.6,
                delay: 0.18,
                ease: [0.16, 1, 0.3, 1],
              },
            })}
            className="mt-7 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg" className="group min-h-[52px]">
              <a href="/sign-up">
                Find my subscriptions
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="group min-h-[52px]"
            >
              <a href="/sample">
                <EyeOff
                  size={15}
                  strokeWidth={2}
                  className="-ml-0.5"
                  aria-hidden="true"
                />
                See a sample report
              </a>
            </Button>
          </motion.div>

          {/* Lock badge directly under the CTAs — trust at the moment
              of the ask (R4 last bullet). text-ink-body for WCAG AA. */}
          <motion.p
            {...m({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { duration: 0.5, delay: 0.24 },
            })}
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-ink-body"
          >
            <Lock
              size={12}
              strokeWidth={2.2}
              className="text-brand"
              aria-hidden="true"
            />
            Read-only · {LANDING.timeToValue.display} · no signup to preview
          </motion.p>

          {/* 5. Consolidated Plaid trust strip (R4). ONE Plaid lockup,
              ONE statement, then a small bank-logo row. Replaces the
              four checkmarks + duplicate "Powered by Plaid · 11,000+
              banks" row from the previous version. */}
          <motion.div
            {...m({
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: 0.6,
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1],
              },
            })}
            className="mt-8 rounded-2xl border border-hairline/80 bg-white/60 backdrop-blur-sm p-4 md:p-5 max-w-[540px]"
          >
            <div className="flex items-center gap-2.5 text-[13px] text-ink-body">
              <PlaidLockup />
              <span className="text-ink-body/60" aria-hidden="true">
                ·
              </span>
              <span className="text-ink font-medium">
                Bank-grade security, read-only
              </span>
            </div>

            <p className="mt-2 text-[12px] text-ink-body/85 leading-relaxed">
              We never see or store your bank credentials. Same
              infrastructure used by {LANDING.plaidPartners.join(" & ")}.
            </p>

            {/* Three reassurance lines pulled from competitor-positioning
                analysis (Reddit "tried every subscription tracker" post):
                  1. We're not Rocket Money — we don't take a cut of
                     cancellations.
                  2. We're not Subcut — we don't read your email.
                  3. We do what Subcut does well — surface direct cancel
                     pages for each finding.
                Each addresses a specific objection cold visitors are
                actively voicing in personal-finance subreddits. Compact
                dot-separated line keeps the strip from growing tall. */}
            <p className="mt-2 text-[11.5px] text-ink-body/80 leading-relaxed">
              No cut of cancellations · We never read your email · Direct
              cancel page for each forgotten sub
            </p>

            {/* Bank wordmark row — US banks, brand-colored pills,
                readable short wordmark on each. Replaces the prior
                2-letter abbreviations that were unreadable. Variable
                width per pill so each name fits without truncation.
                aria-hidden because the names are decorative — the
                real trust signal is rendered as text in the strip
                above. */}
            <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
              {LANDING.bankPlaceholders.map((b) => (
                <span
                  key={b.id}
                  aria-hidden="true"
                  className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-[11px] font-bold text-white tracking-tight whitespace-nowrap"
                  style={{ background: b.color }}
                  title={b.label}
                >
                  {b.label}
                </span>
              ))}
              <span className="text-[11.5px] text-ink-body/85 ml-1">
                +{(LANDING.banks.count - 6).toLocaleString("en-US")} more
              </span>
            </div>

            {/* PDF-upload demand validation CTA — moved here (was
                directly under the lock badge, which gave it too much
                prime real estate next to the primary CTAs). Now lives
                inside the trust strip beneath the bank-logo row, so
                it reads as a "for users who prefer no-bank-link"
                opt-out rather than competing with the main path. */}
            <div className="mt-3 pt-3 border-t border-hairline/60">
              <PdfInterestCta />
            </div>
          </motion.div>

          {/* Disconnect reassurance — single quiet line. The "you're
              not locked in" promise is the specific fear of bank-
              connect products and has its own line so it doesn't get
              lost inside the Plaid strip. */}
          <motion.p
            {...m({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { duration: 0.5, delay: 0.36 },
            })}
            className="mt-4 inline-flex items-center gap-2 text-[12.5px] text-ink-body/85"
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-brand"
            />
            Disconnect anytime — Frugavo loses access instantly.
          </motion.p>
        </div>

        {/* RIGHT — static results preview. On mobile this stacks UNDER
            the trust strip; on desktop it sits beside the copy. The
            preview lives in its own component for clean SSR + a clear
            "no API" boundary. minHeight on the wrapper matches the
            component's reserved height so layout never shifts. */}
        <div
          className="relative w-full"
          style={{ minHeight: 540 }}
        >
          <motion.div
            {...m({
              initial: { opacity: 0, y: 16 },
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: 0.7,
                delay: 0.22,
                ease: [0.16, 1, 0.3, 1],
              },
            })}
          >
            <HeroResultsPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// Plaid wordmark — inline SVG sized to read as a partner lockup, not
// a header logo. Uses currentColor so it inherits the parent ink color
// for WCAG AA contrast on the cream backdrop. Single source of the
// Plaid name in the hero (R1 acceptance).
function PlaidLockup() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-ink-body text-[12px]">Powered by</span>
      <svg
        role="img"
        aria-label="Plaid"
        viewBox="0 0 100 36"
        width="48"
        height="17"
        fill="currentColor"
        className="text-ink"
      >
        <text
          x="0"
          y="27"
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
          fontWeight="700"
          fontSize="28"
          letterSpacing="-1"
        >
          Plaid
        </text>
      </svg>
    </span>
  );
}
