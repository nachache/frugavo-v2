"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import {
  HERO_VARIANTS,
  LANDING,
  type VariantKey,
} from "@/lib/landing/constants";
import { hero as legacyHero } from "@/lib/content";

// Client-only: the HeroDemoCard relies on refs, animation loops, and
// CSS-in-JS that only kick in after hydration. SSR'd it bleeds raw
// "Step 1 of 3 / Connecting securely / $0.00/mo / 0 charges" text
// into the first paint before styles apply. Disabling SSR + a sized
// placeholder eliminates the flash and prevents layout shift.
const HeroDemoCard = dynamic(
  () =>
    import("@/components/sections/hero-demo-card").then((m) => m.HeroDemoCard),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="rounded-3xl border border-hairline bg-canvas/40"
        style={{ minHeight: 560 }}
      />
    ),
  }
);

// Hero is wired for ad-to-page continuity and per-channel variant
// targeting. A visitor arriving from the X "$1,847 hidden bill" ad
// should land here and immediately feel: "Frugavo is about to show
// me the ones I forgot." A visitor arriving from a Mint-refugee
// Google search should land here and feel: "this is the Mint
// replacement."
//
// Architecture:
//   • `variant` prop (set server-side by app/page.tsx via ?v=)
//     selects the headline + subheadline copy from HERO_VARIANTS.
//   • `headlineOverride` prop (set by ?h=control|a|b) overrides
//     just the headline for orthogonal headline A/B testing.
//   • All numbers (dollar figures, time-to-value, source) come from
//     lib/landing/constants so ad creatives and the page can't drift.
//   • Trust block stays right above the primary CTA — bank-credential
//     anxiety is the largest barrier on cold finance traffic.
//   • Secondary CTA "See a sample report" links to /sample, a static
//     zero-bank-required preview page. Cold visitors get to see the
//     output before being asked to connect a bank.

type HeroProps = {
  variant?: VariantKey;
  headlineOverride?: string | undefined;
};

// Trust checks are kept in the component (not in constants) because
// they're never varied per channel — they're the floor of safety
// signals every visitor needs to see before the bank ask.
const TRUST_CHECKS = [
  "Read-only access",
  "Powered by Plaid",
  "We never store banking credentials",
  "Disconnect anytime",
];

export function Hero({ variant = "default", headlineOverride }: HeroProps) {
  // Resolve the active copy. Fall back to the legacy hero object only
  // if HERO_VARIANTS[variant] is missing (should never happen — the
  // type guards prevent it — but defensive against future renames).
  const v = HERO_VARIANTS[variant] ?? HERO_VARIANTS.default;
  const headline = headlineOverride ?? v.headline;
  const subheadline = v.subheadline;
  const eyebrow = v.eyebrow ?? legacyHero.eyebrow;

  // Respect prefers-reduced-motion. With reduced motion enabled, every
  // framer-motion `initial` state collapses to the final state so the
  // hero paints in one frame with no movement. Important for vestibular
  // accessibility (motion sickness, vertigo).
  const reduce = useReducedMotion();
  const m = (
    base: Record<string, unknown>
  ): Record<string, unknown> =>
    reduce ? { initial: false, animate: base.animate } : base;

  return (
    <section
      className="relative pt-12 md:pt-20 pb-20 md:pb-28 overflow-hidden"
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

      <div className="container-page grid lg:grid-cols-[55fr_45fr] gap-12 lg:gap-16 items-center">
        {/* LEFT */}
        <div className="max-w-[640px]">
          <motion.div
            {...m({
              initial: { opacity: 0, y: 16 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
            })}
          >
            <Badge tone="brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {eyebrow}
            </Badge>
          </motion.div>

          <motion.h1
            id="hero-headline"
            {...m({
              initial: { opacity: 0, y: 24 },
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: 0.7,
                delay: 0.08,
                ease: [0.16, 1, 0.3, 1],
              },
            })}
            className="mt-6 font-display font-bold text-ink text-[34px] md:text-[52px] leading-[1.04] tracking-[-0.03em]"
          >
            {headline}
          </motion.h1>

          <motion.p
            {...m({
              initial: { opacity: 0, y: 16 },
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: 0.6,
                delay: 0.14,
                ease: [0.16, 1, 0.3, 1],
              },
            })}
            className="mt-5 max-w-[560px] text-[16.5px] md:text-[19px] leading-relaxed text-ink-body"
          >
            {subheadline}
          </motion.p>

          {/* Source citation — small, muted, but high-enough contrast to
              clear WCAG AA against the cream gradient. Was previously
              `text-ink-muted` which dropped to ~3.8:1 on the cream
              backdrop. Bumped to `text-ink-body` (~7.1:1) and kept the
              size small so it reads as supporting metadata. */}
          <motion.p
            {...m({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { duration: 0.5, delay: 0.18 },
            })}
            className="mt-2 text-[12.5px] text-ink-body/80"
          >
            Source: {LANDING.source}. Average household pays $
            {LANDING.household.annualUsd.toLocaleString("en-US")}/yr in
            subscriptions (USD).
          </motion.p>

          {/* Trust signals — sits ABOVE the CTA. Cold ad traffic needs
              to see the credential-safety story before the bank-connect
              ask, not after. Compact two-column grid on desktop so the
              row doesn't visually compete with the headline. */}
          <motion.ul
            {...m({
              initial: { opacity: 0, y: 16 },
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: 0.6,
                delay: 0.22,
                ease: [0.16, 1, 0.3, 1],
              },
            })}
            className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 max-w-[460px]"
          >
            {TRUST_CHECKS.map((t) => (
              <li
                key={t}
                className="inline-flex items-center gap-2 text-[13.5px] text-ink-body"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-light shrink-0">
                  <Check size={11} className="text-brand" strokeWidth={3} />
                </span>
                <span className="leading-tight">{t}</span>
              </li>
            ))}
          </motion.ul>

          {/* Borrowed-trust strip — Plaid + recognizable fintech names.
              The strongest single credibility move for a small-followers
              brand: lend the familiarity of brands every visitor knows.
              Text color bumped from text-ink-muted to text-ink-body for
              WCAG AA contrast on the cream backdrop. */}
          <motion.div
            {...m({
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.6, delay: 0.26 },
            })}
            className="mt-5 flex items-center gap-3 flex-wrap text-[12.5px] text-ink-body"
          >
            <span>Powered by</span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <svg
                role="img"
                aria-label="Plaid"
                viewBox="0 0 100 36"
                width="58"
                height="20"
                fill="currentColor"
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
            <span aria-hidden="true" className="text-ink-body/40">·</span>
            <span>{LANDING.banks.display} banks</span>
            <span aria-hidden="true" className="text-ink-body/40">·</span>
            <span>Same security used by {LANDING.plaidPartners.join(" & ")}</span>
          </motion.div>

          {/* CTA pair. Primary triggers the Plaid flow (via /sign-up).
              Secondary opens /sample — a zero-bank-required preview of
              what the report looks like. This is THE conversion-rate
              fix for cold traffic that's not ready to link a bank: it
              lets them see the value FIRST, then decide. */}
          <motion.div
            {...m({
              initial: { opacity: 0, y: 16 },
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: 0.7,
                delay: 0.32,
                ease: [0.16, 1, 0.3, 1],
              },
            })}
            className="mt-6 flex flex-wrap items-center gap-3"
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
            {/* Secondary — visually lighter, same tap-target height for
                accessibility. EyeOff icon mirrors the "forgotten" pill
                used inside the sample report so the CTA telegraphs the
                payoff. */}
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

          {/* Micro-copy directly under the CTAs. Restates read-only
              and "no signup to preview" so the choice between the two
              CTAs is clearly disambiguated.
              Color bumped to text-ink-body for AA contrast. */}
          <motion.p
            {...m({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { duration: 0.5, delay: 0.38 },
            })}
            className="mt-4 inline-flex items-center gap-2 text-[13px] text-ink-body"
          >
            <Lock size={11} strokeWidth={2} className="text-brand" aria-hidden="true" />
            Read-only · {LANDING.timeToValue.display} · no signup to preview
          </motion.p>

          {/* Disconnect reassurance — last line, addresses the "am I
              locked in?" fear that's specific to bank-connect products. */}
          <motion.p
            {...m({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { duration: 0.5, delay: 0.42 },
            })}
            className="mt-2 inline-flex items-center gap-2 text-[12.5px] text-ink-body/85"
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-brand"
            />
            Disconnect anytime — Frugavo loses access instantly.
          </motion.p>
        </div>

        {/* RIGHT — animated discovery scan. Visible on mobile too;
            the visual proof reinforces the headline by showing the
            kind of merchant names users typically don't recognize.
            min-height matches the dynamic loading placeholder so
            layout never shifts when the card hydrates. */}
        <div className="relative" style={{ minHeight: 560 }}>
          <HeroDemoCard />
        </div>
      </div>
    </section>
  );
}
