"use client";

import { Stagger, StaggerItem } from "@/components/motion/fade-in";
import { providers } from "@/lib/content";

// Hash the brand name to a stable hue so each monogram has its own color
// without us shipping a lookup table for 30 entries.
function hueFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function Providers() {
  return (
    <section className="py-24 md:py-32 bg-white/40">
      <div className="container-page">
        <div className="max-w-[700px]">
          <span className="text-[13px] font-medium text-brand">Coverage</span>
          <h2 className="mt-2 text-[40px] md:text-[56px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink">
            {providers.heading}
          </h2>
          <p className="mt-4 text-[18px] text-ink-body max-w-[520px]">
            {providers.subhead}
          </p>
        </div>

        <Stagger className="mt-14 grid gap-5 md:grid-cols-3 lg:grid-cols-3">
          {providers.categories.map((cat) => (
            <StaggerItem key={cat.title}>
              <div className="group rounded-3xl bg-white p-6 border border-hairline/60 shadow-soft transition hover:shadow-float hover:-translate-y-1 duration-300">
                <h3 className="text-[13px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
                  {cat.title}
                </h3>
                <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3">
                  {cat.items.map((b) => (
                    <li
                      key={b}
                      className="flex items-center gap-2.5 text-[14px] text-ink"
                    >
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold text-white"
                        style={{
                          background: `hsl(${hueFor(b)} 55% 38%)`,
                        }}
                      >
                        {b.charAt(0)}
                      </span>
                      <span className="truncate">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
