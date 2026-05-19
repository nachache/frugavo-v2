"use client";

import { Plus } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion/fade-in";
import { BrandIcon } from "@/components/ui/brand-icon";
import { providers } from "@/lib/content";

// Hash the brand name to a stable hue so brands without an official glyph
// still get a tinted tile rather than a generic grey block.
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

        <Stagger className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {providers.categories.map((cat) => (
            <StaggerItem key={cat.title}>
              <div className="group h-full rounded-3xl bg-white p-7 border border-hairline/60 shadow-soft transition hover:shadow-float hover:-translate-y-1 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
                    {cat.title}
                  </h3>
                  <span className="text-[11px] tabular-nums text-ink-muted/80">
                    {cat.items.length + cat.moreCount}+ apps
                  </span>
                </div>

                <ul className="mt-5 space-y-3">
                  {cat.items.map((b) => (
                    <li
                      key={b.name}
                      className="flex items-center gap-3 text-[14.5px] text-ink"
                    >
                      {b.id ? (
                        <BrandIcon id={b.id} size="sm" />
                      ) : (
                        <span
                          aria-hidden
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold text-white"
                          style={{
                            background: `hsl(${hueFor(b.name)} 55% 38%)`,
                          }}
                        >
                          {b.name.charAt(0)}
                        </span>
                      )}
                      <span className="truncate">{b.name}</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-3 pt-1">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink/[0.04] text-ink-muted">
                      <Plus size={14} strokeWidth={2.25} />
                    </span>
                    <span className="text-[13.5px] text-ink-muted tnum">
                      {cat.moreCount} more in {cat.title.toLowerCase()}
                    </span>
                  </li>
                </ul>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
