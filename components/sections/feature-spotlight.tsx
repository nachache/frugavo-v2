"use client";

import type { ReactNode } from "react";
import { FadeIn } from "@/components/motion/fade-in";

// Reusable feature-spotlight section — Phase G (2026-06-05).
//
// One section per major product capability, mirroring the rhythm
// used by Rocket Money + Monarch landing pages:
//   ┌──────────────────────────────────────┐
//   │  EYEBROW (caps)                      │
//   │  Display headline                    │
//   │  Body paragraph                      │
//   │  Optional CTA link                   │   [ visual mockup ]
//   │                                      │
//   └──────────────────────────────────────┘
//
// `align="right"` flips the layout so visual goes on the left and
// copy on the right — alternate per section to keep the page from
// feeling like a list.
//
// Children = the visual (typically a SVG mockup component). Kept as
// `children` so callers can plug in any component without prop drilling.

type Props = {
  eyebrow: string;
  headline: string;
  body: string;
  align?: "left" | "right";
  // Optional CTA shown beneath the body
  cta?: { label: string; href: string };
  // The visual to render in the opposite column
  children: ReactNode;
  // Set the section id so nav anchors can deep-link to a specific spot
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
  // Mobile: copy first, visual second (always). Desktop: alternates.
  const copyOrder = align === "left" ? "lg:order-1" : "lg:order-2";
  const visualOrder = align === "left" ? "lg:order-2" : "lg:order-1";

  return (
    <section id={id} className="py-20 md:py-28">
      <div className="container-page">
        <div className="grid gap-10 md:gap-14 lg:grid-cols-2 lg:gap-20 items-center">
          {/* Copy column */}
          <FadeIn>
            <div className={`max-w-[520px] ${copyOrder}`}>
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

          {/* Visual column */}
          <FadeIn delay={0.1}>
            <div className={`relative ${visualOrder}`}>{children}</div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
