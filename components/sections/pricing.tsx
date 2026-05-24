"use client";

import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { pricing } from "@/lib/content";

// Two-plan side-by-side pricing section.
//   - Free: scan + dashboard, $0/mo, neutral card
//   - Peace of Mind: continuous monitoring, $14.99/mo, brand-accented
//     card with "Recommended" badge
//
// On mobile the plans stack. On md+ they sit side-by-side, equal
// width.

export function Pricing() {
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

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 max-w-[920px] mx-auto items-stretch">
          {pricing.plans.map((plan) => {
            const recommended = plan.recommended;
            return (
              <FadeIn key={plan.id}>
                <div
                  className={[
                    "relative rounded-3xl p-7 md:p-8 h-full flex flex-col bg-white shadow-soft border",
                    recommended
                      ? "border-brand/30 ring-1 ring-brand/20"
                      : "border-hairline",
                  ].join(" ")}
                >
                  {recommended && (
                    <div className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-white uppercase">
                      <Sparkles size={11} />
                      Recommended
                    </div>
                  )}

                  <div>
                    <h3 className="text-[22px] font-display font-semibold tracking-[-0.02em] text-ink">
                      {plan.name}
                    </h3>
                    <div className="mt-1 text-[13.5px] text-ink-muted">
                      {plan.tagline}
                    </div>
                  </div>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="text-[58px] md:text-[64px] leading-none font-display font-bold tracking-[-0.04em] text-ink tabular-nums">
                      {plan.priceMonthly === 0
                        ? "Free"
                        : `$${plan.priceMonthly}`}
                    </span>
                    {plan.priceMonthly !== 0 && (
                      <span className="text-[16px] font-medium text-ink-muted">
                        /month
                      </span>
                    )}
                  </div>

                  <ul className="mt-7 space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 text-[14.5px] text-ink-body leading-relaxed"
                      >
                        <Check
                          size={16}
                          className={[
                            "mt-0.5 shrink-0",
                            recommended ? "text-brand" : "text-ink-muted",
                          ].join(" ")}
                          strokeWidth={2.5}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    size="lg"
                    variant={recommended ? "primary" : "outline"}
                    className="mt-7 w-full"
                  >
                    <a href={plan.ctaHref ?? "/sign-up"}>{plan.cta}</a>
                  </Button>
                </div>
              </FadeIn>
            );
          })}
        </div>

        <p className="mt-6 text-center text-[12.5px] text-ink-muted">
          No credit card required for the free scan. Peace of Mind starts with
          a 7-day free trial and you can cancel any time.
        </p>
      </div>
    </section>
  );
}
