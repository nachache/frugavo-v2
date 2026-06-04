"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HERO_VARIANTS,
  type VariantKey,
} from "@/lib/landing/constants";
import { hero as legacyHero } from "@/lib/content";
import { HeroIllustration } from "@/components/sections/hero-illustration";
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

// Headline splitter removed in 2026-06-05 pass. The prior version
// italicized the word "forgot" inside a Fraunces serif headline; the
// new sans-serif "Take control of every subscription" headline
// doesn't have a phrase to italicize, and the editorial italic was
// a major contributor to the "blog" feel the old hero gave off.

export function Hero({ variant = "default", headlineOverride }: HeroProps) {
  const v = HERO_VARIANTS[variant] ?? HERO_VARIANTS.default;
  const headline = headlineOverride ?? v.headline;
  const subheadline = v.subheadline;
  const eyebrow = v.eyebrow ?? legacyHero.eyebrow;

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

          {/* 2. Headline — bold sans (Figtree via font-display).
              Switched from Fraunces editorial serif on 2026-06-05;
              fintech competitors (Rocket Money, Monarch, Cash App)
              all ship bold sans-serif on the hero — the serif was
              reading "blog/indie", the sans reads "product". Tracking
              pulled in tight for display sans character. */}
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
            className="mt-6 font-display text-ink text-[40px] md:text-[60px] leading-[1.02] tracking-[-0.035em] font-bold"
          >
            {headline}
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
                Get started free
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
              of the ask. "No signup to preview" is now a discoverable
              link to /sample so hesitant mobile users who never see
              the secondary CTA button still find the no-bank path. */}
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
            Read-only ·{" "}
            <a
              href="/sample"
              className="underline underline-offset-4 decoration-ink-body/40 hover:text-ink hover:decoration-ink/70 transition"
            >
              No signup to preview a sample
            </a>
          </motion.p>

          {/* 5. Differentiator strip — Phase G pro-polish (2026-06-05).
              Trimmed dramatically: infrastructure trust now lives in
              the dedicated BuiltOnStrip section directly below, so the
              hero strip only needs to communicate what makes Frugavo
              specifically different from Rocket Money / Subcut /
              Monarch. Three short lines, each addressing a known
              competitor objection. Then a quiet PDF-interest opt-out.
              Disconnect line folded in as the last point so the hero
              doesn't end on an orphan paragraph. */}
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
            className="mt-8 max-w-[540px]"
          >
            <ul className="space-y-2 text-[13px] text-ink-body leading-relaxed">
              <DifferentiatorLine>
                <span className="text-ink font-semibold">We never read your email.</span>{" "}
                Bank transactions only, read-only, through Plaid.
              </DifferentiatorLine>
              <DifferentiatorLine>
                <span className="text-ink font-semibold">No upsells, no data resale.</span>{" "}
                Flat $4.99/mo for Protection. We don&apos;t sell your data
                or pitch you anything in-app.
              </DifferentiatorLine>
              <DifferentiatorLine>
                <span className="text-ink font-semibold">Delete every byte in one click.</span>{" "}
                Disconnect anytime — Frugavo loses access instantly.
              </DifferentiatorLine>
            </ul>

            <div className="mt-5">
              <PdfInterestCta />
            </div>
          </motion.div>
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
            <HeroIllustration />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// Tiny "✓"-prefixed differentiator line. The check mark borrows the
// established affirmation pattern from feature lists; we use the
// brand-green tint to subtly tie it to the rest of the strip.
function DifferentiatorLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-brand shrink-0"
      />
      <span>{children}</span>
    </li>
  );
}

// PlaidLockup removed during Phase G pro-polish (2026-06-05). The
// in-hero Plaid lockup was redundant with the BuiltOnStrip section
// directly below the hero, and the SVG rendering of "Plaid" in a
// generic system font looked like a knockoff of the real Plaid mark.
// BuiltOnStrip now owns infrastructure trust; the hero focuses on
// the Frugavo differentiators only.
