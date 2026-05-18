"use client";

import { Eye, Lock, ShieldCheck, type LucideIcon } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion/fade-in";
import { trust } from "@/lib/content";

const iconMap: Record<string, LucideIcon> = { Eye, Lock, ShieldCheck };

export function Trust() {
  return (
    <section className="py-24 md:py-32">
      <div className="container-page">
        <div className="max-w-[640px]">
          <span className="text-[13px] font-medium text-brand">Trust & security</span>
          <h2 className="mt-2 text-[40px] md:text-[56px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink">
            {trust.heading}
          </h2>
        </div>

        <Stagger className="mt-14 grid gap-5 md:grid-cols-3">
          {trust.pillars.map((p) => {
            const Icon = iconMap[p.icon] ?? Lock;
            return (
              <StaggerItem key={p.title}>
                <div className="rounded-3xl bg-white p-7 shadow-soft border border-hairline/60">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white">
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <h3 className="mt-6 text-[20px] font-display font-semibold tracking-[-0.02em] text-ink">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-body">
                    {p.body}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
