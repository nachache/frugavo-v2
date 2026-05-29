"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";

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
import { hero } from "@/lib/content";

// The hero previously displayed a live-incrementing dollar counter labeled
// "saved by Frugavo users this month". Pre-launch, Frugavo has no real users
// and no real savings, so that counter was a misleading social-proof claim
// under both Google Ads (Personal Finance policy) and Meta Ads (financial
// services policy). Removed pending a real server-tracked metric.
//
// In its place: three static value-prop chips. Each describes a structural
// product feature, not a personalized financial outcome.

// Founder-Access-era value props. No "trial," no "cancel any time"
// (there's no billing to cancel). What we promise: the system unlocks
// in seconds, never asks for a card, and never feels noisy. The third
// line is intentionally about the experience, not the price.
const VALUE_PROPS = [
  "Open access during beta",
  "No credit card, ever",
  "Calm by design",
];

export function Hero() {
  return (
    <section className="relative pt-12 md:pt-20 pb-20 md:pb-28 overflow-hidden">
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
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Badge tone="brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {hero.eyebrow}
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-6 font-display font-bold text-ink text-[36px] md:text-[56px] leading-[1.05] tracking-[-0.03em]"
          >
            Your subscription{" "}
            <span className="text-brand">protection intelligence</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.14,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-5 max-w-[620px] text-[20px] md:text-[24px] leading-snug text-ink font-medium tnum"
          >
            89% of Americans think they spend{" "}
            <span className="text-ink/50">$86</span>/month on subscriptions —{" "}
            <span className="text-brand">it&apos;s really $219.</span>
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-2 text-[12.5px] text-ink-muted tnum"
          >
            {hero.sourceCitation}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.24,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg" className="group">
              <a href={hero.primaryCta.href}>
                {hero.primaryCta.label}
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-0.5"
                />
              </a>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <a href={hero.secondaryCta.href}>{hero.secondaryCta.label}</a>
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.32 }}
            className="mt-5 text-[13px] text-ink-muted"
          >
            {hero.trust}
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-ink-body"
          >
            {VALUE_PROPS.map((v) => (
              <li key={v} className="inline-flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-light">
                  <Check size={11} className="text-brand" strokeWidth={3} />
                </span>
                {v}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* RIGHT — animated demo card. Visible on mobile too;
            the user prefers the motion / visual proof above the
            fold even at the cost of a bit more scroll. */}
        <div className="relative">
          <HeroDemoCard />
        </div>
      </div>
    </section>
  );
}
