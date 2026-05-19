"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeroDemoCard } from "@/components/sections/hero-demo-card";
import { hero } from "@/lib/content";

// The hero previously displayed a live-incrementing dollar counter labeled
// "saved by Frugavo users this month". Pre-launch, Frugavo has no real users
// and no real savings, so that counter was a misleading social-proof claim
// under both Google Ads (Personal Finance policy) and Meta Ads (financial
// services policy). Removed pending a real server-tracked metric.
//
// In its place: three static value-prop chips. Each describes a structural
// product feature, not a personalized financial outcome.

const VALUE_PROPS = [
  "Free to join the waitlist",
  "No credit card required",
  "Cancel any time",
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
            className="mt-6 text-hero font-display font-bold text-ink"
          >
            {hero.headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.16,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-6 max-w-[560px] text-[18px] md:text-[19px] leading-relaxed text-ink-body"
          >
            {hero.subhead}
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

        {/* RIGHT — animated demo card */}
        <div className="relative">
          <HeroDemoCard />
        </div>
      </div>
    </section>
  );
}
