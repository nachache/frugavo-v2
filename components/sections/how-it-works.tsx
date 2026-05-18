"use client";

import { Inbox, Search, Zap, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Stagger, StaggerItem } from "@/components/motion/fade-in";
import { howItWorks } from "@/lib/content";

const iconMap: Record<string, LucideIcon> = { Inbox, Search, Zap };

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

        <Stagger
          stagger={0.15}
          className="mt-14 grid gap-5 md:grid-cols-3"
        >
          {howItWorks.steps.map((step) => {
            const Icon = iconMap[step.icon] ?? Inbox;
            return (
              <StaggerItem key={step.n}>
                <article className="group relative h-full rounded-3xl bg-white p-7 shadow-soft border border-hairline/60 overflow-hidden transition hover:shadow-float hover:-translate-y-1 duration-300">
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

                  <h3 className="mt-10 text-[22px] font-display font-semibold tracking-[-0.02em] text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-body">
                    {step.body}
                  </p>

                  {/* decorative SVG corner illustration */}
                  <StepArt index={step.n} />
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
        viewBox="0 0 160 100"
        className="pointer-events-none absolute -bottom-2 -right-2 h-24 w-40 opacity-90"
        aria-hidden
      >
        <rect x="20" y="14" width="120" height="14" rx="4" fill="#ECFDF5" />
        <rect x="20" y="34" width="120" height="14" rx="4" fill="#ECFDF5" />
        <rect x="20" y="54" width="120" height="14" rx="4" fill="#FAF8F4" />
        <rect x="20" y="74" width="120" height="14" rx="4" fill="#FAF8F4" />
        <circle cx="34" cy="21" r="3" fill="#047857" />
        <circle cx="34" cy="41" r="3" fill="#047857" />
      </svg>
    );
  }
  if (index === "02") {
    // magnifier finding a hit
    return (
      <svg
        viewBox="0 0 160 100"
        className="pointer-events-none absolute -bottom-2 -right-2 h-24 w-40 opacity-90"
        aria-hidden
      >
        <circle cx="100" cy="50" r="22" stroke="#047857" strokeWidth="2.5" fill="none" />
        <line x1="116" y1="66" x2="138" y2="86" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="50" r="6" fill="#EA580C" />
      </svg>
    );
  }
  return (
    // lightning + checkmark
    <svg
      viewBox="0 0 160 100"
      className="pointer-events-none absolute -bottom-2 -right-2 h-24 w-40 opacity-90"
      aria-hidden
    >
      <path
        d="M86 18 L70 56 L88 56 L78 86 L114 46 L94 46 L104 18 Z"
        fill="#FED7AA"
        stroke="#EA580C"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="130" cy="78" r="10" fill="#047857" />
      <path d="M125 78 L129 82 L135 75" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
