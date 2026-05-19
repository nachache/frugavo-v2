"use client";

import { Inbox, Landmark, Search, Zap, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Stagger, StaggerItem } from "@/components/motion/fade-in";
import { howItWorks } from "@/lib/content";

const iconMap: Record<string, LucideIcon> = { Inbox, Landmark, Search, Zap };

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32">
      <div className="container-page">
        <div className="max-w-[640px]">
          <span className="text-[13px] font-medium text-brand">How it works</span>
          <h2 className="mt-2 text-[40px] md:text-[56px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink">
            {howItWorks.heading}
          </h2>
        </div>

        <Stagger stagger={0.15} className="mt-14 grid gap-5 md:grid-cols-3">
          {howItWorks.steps.map((step) => {
            const Icon = iconMap[step.icon] ?? Inbox;
            return (
              <StaggerItem key={step.n}>
                <article className="group flex h-full flex-col rounded-3xl bg-white p-7 shadow-soft border border-hairline/60 overflow-hidden transition hover:shadow-float hover:-translate-y-1 duration-300">
                  <div className="flex items-start justify-between">
                    <span className="text-[44px] font-display font-bold text-ink/10 tracking-[-0.04em] leading-none">
                      {step.n}
                    </span>
                    <motion.span
                      initial={{ rotate: -12, opacity: 0 }}
                      whileInView={{ rotate: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand"
                    >
                      <Icon size={20} strokeWidth={2} />
                    </motion.span>
                  </div>

                  <div className="mt-10 flex-1">
                    <h3 className="text-[22px] font-display font-semibold tracking-[-0.02em] text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-body">
                      {step.body}
                    </p>
                  </div>

                  {/* Illustration occupies its own panel below the text. */}
                  <div className="mt-7 -mx-7 -mb-7 h-28 bg-canvas/60 border-t border-hairline/60 flex items-center justify-center overflow-hidden">
                    <StepArt index={step.n} />
                  </div>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

function StepArt({ index }: { index: string }) {
  if (index === "01") {
    // stylized inbox stack
    return (
      <svg
        viewBox="0 0 200 80"
        className="h-20 w-auto"
        aria-hidden
      >
        <rect x="20" y="8" width="160" height="14" rx="4" fill="#ECFDF5" />
        <rect x="20" y="28" width="160" height="14" rx="4" fill="#ECFDF5" />
        <rect x="20" y="48" width="160" height="14" rx="4" fill="#FFFFFF" stroke="#E5E5E5" />
        <circle cx="34" cy="15" r="3" fill="#047857" />
        <circle cx="34" cy="35" r="3" fill="#047857" />
        <rect x="44" y="11" width="60" height="8" rx="2" fill="#047857" opacity="0.35" />
        <rect x="44" y="31" width="80" height="8" rx="2" fill="#047857" opacity="0.35" />
        <rect x="44" y="51" width="50" height="8" rx="2" fill="#0A0A0A" opacity="0.18" />
      </svg>
    );
  }
  if (index === "02") {
    // magnifier finding a hit + faint list lines behind
    return (
      <svg
        viewBox="0 0 200 80"
        className="h-20 w-auto"
        aria-hidden
      >
        <rect x="14" y="14" width="80" height="6" rx="3" fill="#0A0A0A" opacity="0.08" />
        <rect x="14" y="30" width="100" height="6" rx="3" fill="#0A0A0A" opacity="0.08" />
        <rect x="14" y="46" width="70" height="6" rx="3" fill="#0A0A0A" opacity="0.08" />
        <rect x="14" y="62" width="90" height="6" rx="3" fill="#0A0A0A" opacity="0.08" />
        <circle cx="138" cy="38" r="22" stroke="#047857" strokeWidth="2.5" fill="#FFFFFF" />
        <circle cx="138" cy="38" r="6" fill="#EA580C" />
        <line x1="154" y1="54" x2="178" y2="74" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    // lightning + checkmark beside it
    <svg
      viewBox="0 0 200 80"
      className="h-20 w-auto"
      aria-hidden
    >
      <path
        d="M86 8 L66 42 L86 42 L74 72 L116 32 L94 32 L102 8 Z"
        fill="#FED7AA"
        stroke="#EA580C"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="148" cy="40" r="14" fill="#047857" />
      <path
        d="M141 40 L146 45 L155 35"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
