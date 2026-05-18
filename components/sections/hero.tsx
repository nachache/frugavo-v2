"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/motion/count-up";
import { HeroDemoCard } from "@/components/sections/hero-demo-card";
import { hero } from "@/lib/content";

export function Hero() {
  const reduced = useReducedMotion();
  const [total, setTotal] = useState(hero.counterStart);

  // Living counter: small random increments every 2-4s after the initial
  // count-up has settled. Feels less like a static number on the page.
  useEffect(() => {
    if (reduced) return;
    let timer: number;
    const tick = () => {
      setTotal((v) => v + Math.floor(Math.random() * 14) + 1);
      timer = window.setTimeout(tick, 2000 + Math.random() * 2000);
    };
    timer = window.setTimeout(tick, 2200);
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <section className="relative pt-32 md:pt-40 pb-20 md:pb-28 overflow-hidden">
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

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex items-center gap-3 text-[14px] text-ink-body"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light">
              <Check size={14} className="text-brand" />
            </span>
            <span className="tnum">
              <CountUp
                to={total}
                duration={1200}
                prefix="$"
                triggerOnInView
                className="font-semibold text-ink"
              />{" "}
              <span className="text-ink-muted">{hero.counterLabel}</span>
            </span>
          </motion.div>
        </div>

        {/* RIGHT — animated demo card */}
        <div className="relative">
          <HeroDemoCard />
        </div>
      </div>
    </section>
  );
}

