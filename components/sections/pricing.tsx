"use client";

import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { access } from "@/lib/content";

// Founder Access section — replaces the old two-tier pricing card.
//
// Mirrors the in-app FounderAccessCard so the marketing page and the
// product speak with one voice. There is no "Free vs Premium" choice
// on offer: every protection feature is unlocked during early
// access. We still communicate the future paid relationship clearly
// so the perceived-value architecture stays intact.
//
// Renamed export kept as `Pricing` so the import in app/page.tsx
// doesn't need to change — the section's role in the IA hasn't moved,
// only the framing has.
//
// When monetization actually begins, this component is the second
// thing to edit (after lib/billing/beta.ts flips off).

export function Pricing() {
  return (
    <section id="access" className="py-24 md:py-32 bg-white/40">
      <div className="container-page">
        <FadeIn>
          <div className="max-w-[720px]">
            <span className="text-[13px] font-medium text-brand">
              Access
            </span>
            <h2 className="mt-2 text-[40px] md:text-[56px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink">
              {access.heading}
            </h2>
            <p className="mt-4 text-[18px] text-ink-body leading-relaxed">
              {access.subhead}
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="mt-12 max-w-[760px] mx-auto">
            <div className="relative rounded-3xl p-7 md:p-10 bg-white shadow-soft border border-brand/25 ring-1 ring-brand/15">
              {/* Founder Access badge — sits over the top edge in the
                  same slot the old "Recommended" sticker used, but
                  reads as identity rather than upsell pressure. */}
              <div className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-white uppercase">
                <Sparkles size={11} />
                Founder Access
              </div>

              <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                {access.featuresHeading}
              </div>

              <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
                {access.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-[14.5px] text-ink-body leading-relaxed"
                  >
                    <Check
                      size={16}
                      className="text-brand mt-0.5 shrink-0"
                      strokeWidth={2.5}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <p className="mt-7 pt-6 border-t border-hairline/60 text-[13px] text-ink-muted leading-relaxed max-w-[560px]">
                {access.futureNote}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <a href={access.ctaHref}>{access.cta}</a>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <a href={access.secondaryCtaHref}>{access.secondaryCta}</a>
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
