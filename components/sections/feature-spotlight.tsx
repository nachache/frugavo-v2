"use client";

import type { ReactNode } from "react";
import { FadeIn } from "@/components/motion/fade-in";

// Reusable feature-spotlight section.
//
// Layout: copy on one side, visual on the other, alternating per
// section so the page reads as a thoughtful walkthrough.
//
// IMPORTANT layout fix (2026-06-05): the previous version applied
// `lg:order-*` classes to the inner div inside each FadeIn wrapper.
// Order only works on direct children of the grid container, and
// the FadeIn wrapper IS the direct child — so the inner div's
// order class was silently ignored and every spotlight rendered
// in the same direction. Fix: apply the order classes to the
// FadeIn wrappers themselves via the new `wrapperClassName` prop
// (passed through to the underlying div). Mobile always stacks
// copy-first; alternation only kicks in at lg+.

type Props = {
  eyebrow: string;
  headline: string;
  body: string;
  align?: "left" | "right";
  // Optional CTA shown beneath the body
  cta?: { label: string; href: string };
  // The visual to render in the opposite column
  children: ReactNode;
  // Set the section id so nav anchors can deep-link
  id?: string;
};

export function FeatureSpotlight({
  eyebrow,
  headline,
  body,
  align = "left",
  cta,
  children,
  id,
}: Props) {
  // align="left" = copy on left, visual on right (default DOM order)
  // align="right" = copy on right, visual on left (swap via order)
  const copyOrder = align === "left" ? "lg:order-1" : "lg:order-2";
  const visualOrder = align === "left" ? "lg:order-2" : "lg:order-1";

  return (
    <section id={id} className="py-20 md:py-28">
      <div className="container-page">
        <div className="grid gap-10 md:gap-14 lg:grid-cols-2 lg:gap-20 items-center">
          {/* Copy column — order applied to the grid child directly */}
          <div className={copyOrder}>
            <FadeIn>
              <div className="max-w-[520px]">
                <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">
                  {eyebrow}
                </span>
                <h2 className="mt-3 font-display text-[32px] md:text-[44px] font-bold tracking-[-0.025em] leading-[1.1] text-ink">
                  {headline}
                </h2>
                <p className="mt-5 text-[16.5px] md:text-[18px] leading-relaxed text-ink-body">
                  {body}
                </p>
                {cta && (
                  <a
                    href={cta.href}
                    className="mt-6 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-brand hover:text-brand/80 transition group"
                  >
                    {cta.label}
                    <span
                      aria-hidden="true"
                      className="transition group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </a>
                )}
              </div>
            </FadeIn>
          </div>

          {/* Visual column — order applied to the grid child directly */}
          <div className={visualOrder}>
            <FadeIn delay={0.1}>
              <div className="relative">{children}</div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}
