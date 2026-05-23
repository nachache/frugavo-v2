"use client";

import { useEffect, useMemo, useState } from "react";
import { CountUp } from "@/components/motion/count-up";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

export function Calculator() {
  const [have, setHave] = useState(8);
  const [use, setUse] = useState(4);
  const [avg, setAvg] = useState(14);

  // Used count cannot exceed total count.
  useEffect(() => {
    if (use > have) setUse(have);
  }, [have, use]);

  const wastedYearly = useMemo(
    () => Math.max(0, (have - use) * avg * 12),
    [have, use, avg]
  );

  return (
    <section className="py-24 md:py-32">
      <div className="container-page">
        <FadeIn>
          <div className="max-w-[760px]">
            <span className="text-[13px] font-medium text-brand">Calculator</span>
            <h2 className="mt-2 text-[40px] md:text-[56px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink">
              How much are you losing to subscriptions you don't use?
            </h2>
          </div>
        </FadeIn>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* sliders */}
          <FadeIn>
            <div className="rounded-3xl bg-white border border-hairline/60 p-7 shadow-soft">
              <Slider
                label="Subscriptions you think you have"
                value={have}
                min={1}
                max={30}
                onChange={setHave}
                format={(v) => `${v}`}
              />
              <div className="my-6 h-px bg-hairline/60" />
              <Slider
                label="Subscriptions you actually use"
                value={use}
                min={0}
                max={have}
                onChange={setUse}
                format={(v) => `${v}`}
              />
              <div className="my-6 h-px bg-hairline/60" />
              <Slider
                label="Average $/month per sub"
                value={avg}
                min={5}
                max={100}
                onChange={setAvg}
                format={(v) => `$${v}`}
              />
            </div>
          </FadeIn>

          {/* output */}
          <FadeIn delay={0.1}>
            <div className="relative h-full rounded-3xl bg-brand-light p-7 overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-32 -right-20 h-[320px] w-[320px] rounded-full bg-emerald-300/30 blur-3xl"
              />
              <div className="relative flex flex-col h-full">
                <div className="text-[12.5px] uppercase tracking-[0.14em] text-emerald-900/70 font-semibold">
                  Estimated yearly waste
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <CountUp
                    to={wastedYearly}
                    duration={600}
                    prefix="$"
                    className="text-[clamp(56px,8vw,96px)] leading-none font-display font-bold tracking-[-0.04em] text-brand tnum"
                  />
                  <span className="text-[18px] font-medium text-brand/80">/yr</span>
                </div>
                <p className="mt-5 text-[15px] leading-relaxed text-emerald-900/85 max-w-[400px]">
                  on subscriptions you don&apos;t use, based on the inputs you
                  entered.
                </p>
                <p className="mt-3 text-[12.5px] leading-relaxed text-emerald-900/60 max-w-[400px]">
                  Estimate based on your inputs. Individual results will vary;
                  not a guarantee of savings.
                </p>
                <div className="mt-auto pt-8">
                  <a
                    href="/sign-up"
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 h-11 text-[14px] font-medium text-white hover:bg-ink/85 transition"
                  >
                    Start Scan →
                  </a>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const pct = ((value - min) / Math.max(1, max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[14px] text-ink-body">{label}</label>
        <span className="text-[18px] font-semibold text-ink tnum">
          {format(value)}
        </span>
      </div>
      <div className="relative mt-3 h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-ink/[0.06]" />
        <div
          className="absolute h-1.5 rounded-full bg-brand"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "relative h-5 w-full cursor-pointer appearance-none bg-transparent",
            // thumb
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-white",
            "[&::-webkit-slider-thumb]:border-[1.5px]",
            "[&::-webkit-slider-thumb]:border-brand",
            "[&::-webkit-slider-thumb]:shadow-soft",
            "[&::-webkit-slider-thumb]:cursor-grab",
            "[&::-webkit-slider-thumb]:active:scale-110",
            "[&::-webkit-slider-thumb]:transition",
            // firefox
            "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5",
            "[&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-white",
            "[&::-moz-range-thumb]:border-[1.5px]",
            "[&::-moz-range-thumb]:border-brand",
            "[&::-moz-range-thumb]:cursor-grab"
          )}
          aria-label={label}
        />
      </div>
    </div>
  );
}
