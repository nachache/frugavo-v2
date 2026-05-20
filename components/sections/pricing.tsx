"use client";

import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { pricing } from "@/lib/content";

// v1 pricing is a single $5/mo flat plan. We dropped the dual-card
// "Flat vs Performance" layout because the Performance tier required a
// savings-tracking system we don't have in v1.

export function Pricing() {
  const [plan] = pricing.plans;

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

        <div className="mt-12 max-w-[520px] mx-auto">
          <FadeIn>
            <div className="gradient-border-rotating relative rounded-3xl bg-white p-8 shadow-soft">
              <div className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-white uppercase">
                <Sparkles size={11} />
                Early access
              </div>

              <h3 className="text-[22px] font-display font-semibold tracking-[-0.02em] text-ink">
                {plan.name}
              </h3>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-[72px] leading-none font-display font-bold tracking-[-0.04em] text-ink tnum">
                  ${plan.priceMonthly}
                </span>
                <span className="text-[16px] font-medium text-ink-muted">
                  /month
                </span>
              </div>
              <p className="mt-2 text-[13px] text-ink-muted">
                The scan itself is free. You only pay once you want the full
                list and the cancel-assist tools.
              </p>

              <ul className="mt-7 space-y-3">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-[14.5px] text-ink-body"
                  >
                    <Check
                      size={16}
                      className="mt-0.5 text-brand shrink-0"
                      strokeWidth={2.5}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <Button asChild size="lg" className="mt-8 w-full">
                <a href="#cta">{plan.cta}</a>
              </Button>

              <p className="mt-4 text-center text-[12px] text-ink-muted">
                Scan is free. You only pay once you want to cancel
                subscriptions or get monthly alerts.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
