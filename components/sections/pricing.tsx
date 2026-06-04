"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { pricing } from "@/lib/content";

// Two-tier pricing section — Phase G rebuild (2026-06-05).
//
// Replaces the previous single-tier "Founder Access" framing. Frugavo
// has graduated from beta; the marketing site now lines up with the
// in-app entitlement state (lib/billing/beta.ts):
//   - Free tier ($0 forever): discovery + read-only viewing.
//   - Protection tier ($4.99/mo): continuous monitoring + alerts +
//     cancel-assist tracking + multi-account coverage.
//
// Visual language mirrors Rocket Money / Monarch:
//   - Two side-by-side cards on desktop, stacked on mobile.
//   - Protection card is the featured tier (subtle highlight + badge).
//   - Each tier has a clear price, tagline, full feature list, primary
//     CTA, and an optional CTA note (e.g. "7 days free").
//
// Section id "pricing" matches the nav anchor + footer link. Old
// "access" anchor still works at the route level via redirect (none
// configured — the anchor just won't scroll, which is acceptable).

export function Pricing() {
  return (
    <section
      id="pricing"
      className="py-24 md:py-32 bg-white/40"
      aria-labelledby="pricing-heading"
    >
      <div className="container-page">
        {/* Header */}
        <FadeIn>
          <div className="max-w-[760px] mx-auto text-center">
            <span className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">
              Pricing
            </span>
            <h2
              id="pricing-heading"
              className="mt-2 text-[40px] md:text-[56px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink"
            >
              {pricing.heading}
            </h2>
            <p className="mt-4 text-[17px] md:text-[18px] text-ink-body leading-relaxed">
              {pricing.subhead}
            </p>
          </div>
        </FadeIn>

        {/* Tier grid — 1 column on mobile, 2 on tablet+ */}
        <div className="mt-12 md:mt-14 grid gap-6 md:grid-cols-2 max-w-[920px] mx-auto items-stretch">
          {pricing.tiers.map((tier, i) => (
            <FadeIn key={tier.id} delay={i * 0.08}>
              <PricingCard tier={tier} />
            </FadeIn>
          ))}
        </div>

        {/* Trust line beneath cards — single quiet note */}
        <p className="mt-8 text-center text-[13px] text-ink-body">
          No bank credentials stored · Cancel anytime · Read-only via Plaid
        </p>
      </div>
    </section>
  );
}

type Tier = (typeof pricing.tiers)[number];

function PricingCard({ tier }: { tier: Tier }) {
  const featured = "featured" in tier && tier.featured;

  return (
    <div
      className={
        "relative h-full rounded-3xl p-7 md:p-9 transition " +
        (featured
          ? "bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] border border-brand/30 ring-1 ring-brand/15"
          : "bg-white shadow-soft border border-hairline/70")
      }
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 sm:left-7 sm:translate-x-0 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[10.5px] font-semibold tracking-[0.1em] text-white uppercase shadow-[0_4px_14px_-2px_rgba(10,10,10,0.25)] whitespace-nowrap">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand" aria-hidden="true" />
          Recommended
        </div>
      )}

      {/* Tier name + tagline */}
      <div>
        <h3 className="font-display text-[22px] md:text-[24px] font-bold tracking-[-0.015em] text-ink">
          {tier.name}
        </h3>
        <p className="mt-1 text-[14px] text-ink-body">{tier.tagline}</p>
      </div>

      {/* Price block */}
      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="font-display text-[44px] md:text-[52px] font-bold tracking-[-0.03em] leading-none text-ink tnum">
          {tier.price}
        </span>
        <span className="text-[14px] text-ink-body">/ {tier.cadence}</span>
      </div>

      {/* CTA */}
      <div className="mt-6">
        <Button asChild size="lg" className="w-full">
          <a href={tier.cta.href}>{tier.cta.label}</a>
        </Button>
        {"ctaNote" in tier && tier.ctaNote && (
          <p className="mt-2 text-center text-[12px] text-ink-body">
            {tier.ctaNote}
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="mt-7 pt-7 border-t border-hairline/60 space-y-3">
        {tier.features.map((feat, idx) => {
          // First feature in Protection tier is a header line
          // ("Everything in Free, plus:") — render without checkmark.
          const isHeader = featured && idx === 0;
          if (isHeader) {
            return (
              <li
                key={feat}
                className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-body/85"
              >
                {feat}
              </li>
            );
          }
          return (
            <li
              key={feat}
              className="flex items-start gap-2.5 text-[14.5px] text-ink-body leading-relaxed"
            >
              <Check
                size={16}
                className="text-brand mt-0.5 shrink-0"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <span>{feat}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
