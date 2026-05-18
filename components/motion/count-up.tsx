"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

// requestAnimationFrame-driven count-up.  Eases out so the final digits settle
// smoothly instead of stopping cold.  Tabular figures so digits don't jitter.

type Props = {
  to: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  // If true, only fires once when scrolled into view.  Otherwise, animates from
  // current value to `to` whenever `to` changes (e.g. slider input).
  triggerOnInView?: boolean;
  separator?: boolean;
};

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

export function CountUp({
  to,
  duration = 600,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  triggerOnInView = false,
  separator = true,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();

  const [value, setValue] = useState(triggerOnInView ? 0 : to);
  const fromRef = useRef(triggerOnInView ? 0 : to);
  const startedRef = useRef(false);

  useEffect(() => {
    if (triggerOnInView && !inView) return;

    if (reduced) {
      setValue(to);
      fromRef.current = to;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutQuart(t);
      const current = from + (to - from) * eased;
      setValue(current);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };

    raf = requestAnimationFrame(tick);
    startedRef.current = true;

    return () => cancelAnimationFrame(raf);
  }, [to, duration, inView, triggerOnInView, reduced]);

  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: separator,
  });

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {formatter.format(value)}
      {suffix}
    </span>
  );
}
