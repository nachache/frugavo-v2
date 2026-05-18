"use client";

import { pressLogos } from "@/lib/content";

// Auto-scrolling marquee. We duplicate the list so the loop is seamless, and
// pause on hover. Individual logos restore color on hover.
export function SocialProof() {
  const items = [...pressLogos, ...pressLogos];
  return (
    <section className="py-10 border-y border-hairline/60 bg-white/40">
      <div className="container-page">
        <p className="text-center text-[12px] uppercase tracking-[0.18em] text-ink-muted mb-6">
          As featured in
        </p>
        <div className="group relative mask-fade-x overflow-hidden">
          <div className="flex w-max items-center gap-12 animate-marquee group-hover:[animation-play-state:paused]">
            {items.map((name, i) => (
              <span
                key={i}
                className="font-display text-[22px] md:text-[26px] tracking-[-0.02em] font-semibold text-ink-muted/60 hover:text-ink transition whitespace-nowrap"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
