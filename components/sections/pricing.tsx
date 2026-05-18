"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { pricing } from "@/lib/content";
import { cn } from "@/lib/utils";

type Cadence = "monthly" | "annual";

export function Pricing() {
  const [cadence, setCadence] = useState<Cadence>("annual");
  const [flat, performance] = pricing.plans;

  const flatPrice =
    cadence === "monthly"
      ? { big: flat.priceMonthly, unit: "/mo", note: undefined }
      : { big: flat.priceAnnual, unit: "/yr", note: `save $${flat.annualSavings}` };

  return (
    <section id="pricing" className="py-24 md:py-32 bg-white/40">
      <div className="container-page">
        <FadeIn>
          <div className="max-w-[680px]">
            <span className="text-[13px] font-medium text-brand">Pricing</span>
            <h2 className="mt-2 text-[40px] md:text-[56px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink">
              {pricing.heading}
            </h2>
            <p className="mt-4 text-[18px] text-ink-body">{pricing.subhead}</p>
          </div>
        </FadeIn>

        <div className="mt-12 grid gap-6 lg:grid-cols-2 max-w-[960px]">
          {/* FLAT */}
          <FadeIn>
            <div className="gradient-border-rotating relative h-full rounded-3xl bg-white p-8 shadow-soft">
              <div className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-white uppercase">
                <Sparkles size={11} />
                Recommended
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-[22px] font-display font-semibold tracking-[-0.02em] text-ink">
                  {flat.name}
                </h3>

                {/* monthly/annual toggle */}
                <div className="inline-flex rounded-full bg-ink/[0.05] p-1 text-[12px]">
                  {(["monthly", "annual"] as Cadence[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCadence(c)}
                      className={cn(
                        "relative rounded-full px-3 py-1.5 capitalize transition",
                        cadence === c ? "text-ink" : "text-ink-muted hover:text-ink"
                      )}
                    >
                      {cadence === c && (
                        <motion.span
                          layoutId="cadence-pill"
                          transition={{ type: "spring", stiffness: 360, damping: 30 }}
                          className="absolute inset-0 rounded-full bg-white shadow-soft"
                        />
                      )}
                      <span className="relative">{c}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-[64px] leading-none font-display font-bold tracking-[-0.04em] text-ink tnum">
                  ${flatPrice.big}
                </span>
                <span className="text-[16px] font-medium text-ink-muted">
                  {flatPrice.unit}
                </span>
                {flatPrice.note && (
                  <span className="ml-1 inline-flex items-center rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-medium text-brand">
                    {flatPrice.note}
                  </span>
                )}
              </div>

              <ul className="mt-7 space-y-3">
                {flat.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14px] text-ink-body">
                    <Check size={16} className="mt-0.5 text-brand shrink-0" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              <Button asChild size="lg" className="mt-8 w-full">
                <a href="#cta">{flat.cta}</a>
              </Button>
            </div>
          </FadeIn>

          {/* PERFORMANCE */}
          <FadeIn delay={0.1}>
            <div className="relative h-full rounded-3xl bg-white p-8 shadow-soft border border-hairline/60">
              <h3 className="text-[22px] font-display font-semibold tracking-[-0.02em] text-ink">
                {performance.name}
              </h3>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-[64px] leading-none font-display font-bold tracking-[-0.04em] text-ink tnum">
                  30%
                </span>
                <span className="text-[14px] font-medium text-ink-muted max-w-[180px]">
                  of first-year savings, per cancelled sub
                </span>
              </div>

              <ul className="mt-7 space-y-3">
                {performance.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14px] text-ink-body">
                    <Check size={16} className="mt-0.5 text-brand shrink-0" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              <Button asChild size="lg" variant="dark" className="mt-8 w-full">
                <a href="#cta">{performance.cta}</a>
              </Button>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
