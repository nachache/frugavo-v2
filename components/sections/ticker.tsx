"use client";

import { useReducedMotion } from "framer-motion";
import { ticker } from "@/lib/content";

// ──────────────────────────────────────────────────────────────────
// FluidTicker — high-quality horizontal marquee.
//
// Mental model:
//   The track holds TWO copies of the same string list, joined end
//   to end. The track translates left at constant velocity from 0%
//   to -50% — which is exactly the width of one copy. The instant
//   it loops back to 0%, the second copy is already at the position
//   the first copy started. Result: a single seamless infinite scroll
//   with zero jump, zero gap.
//
// Why pure CSS, not framer:
//   The animation must run on the compositor thread for 60fps. A JS
//   tick (framer's animate(...) on a value) costs a React reconcile
//   for every frame, which gives 30–45fps under load. A `transform`
//   CSS animation with `will-change: transform` runs entirely off the
//   main thread.
//
// Why two copies (50% loop), not three:
//   With two copies the keyframe end-state is exactly the width of
//   one copy, so the modulo math is implicit in the animation. With
//   three copies you'd need a 33.333…% target, which can produce a
//   sub-pixel jitter on some browsers when the float doesn't round.
//
// Quality touches:
//   • mask-image fades the strings at both edges — no hard cut.
//   • Hover pauses the scroll. Lets a curious visitor finish reading.
//   • prefers-reduced-motion shows a single static line.
//   • Inline-blocks with non-breaking joins ensure the items never
//     wrap to a second row, even at narrow widths.
//
// Tone:
//   The "Sample observations" pill labels the strip as illustrative.
//   Strings live in lib/content.ts and follow the "Frugavo noticed…"
//   voice. Never claims savings, never adds urgency.
// ──────────────────────────────────────────────────────────────────

const SCROLL_DURATION_SECONDS = 80;

export function Ticker() {
  const reduced = useReducedMotion();

  // Reduced motion: show a single line, no animation. The first
  // sample is enough to communicate "this is what Frugavo notices."
  if (reduced) {
    return (
      <div className="border-y border-hairline/60 bg-white/40 py-3.5">
        <div className="container-page flex items-center gap-3 overflow-hidden">
          <SampleBadge />
          <span className="text-[13px] text-ink-body truncate">
            {ticker[0]}
          </span>
        </div>
      </div>
    );
  }

  // We render the items twice so the -50% keyframe loops seamlessly.
  // Each item gets a separator dot rendered as part of the same span,
  // so the items themselves can be plain strings.
  const items = ticker;

  return (
    <div className="border-y border-hairline/60 bg-white/40 py-3.5">
      <div className="container-page flex items-center gap-3 overflow-hidden">
        <SampleBadge />
        <div
          className="relative flex-1 overflow-hidden"
          style={{
            // Fade the edges so strings melt in/out instead of
            // hard-cutting at the container boundary.
            maskImage:
              "linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 64px), transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 64px), transparent 100%)",
          }}
        >
          <div
            className="ticker-track flex w-max items-center"
            style={{
              animation: `ticker-scroll ${SCROLL_DURATION_SECONDS}s linear infinite`,
              willChange: "transform",
            }}
          >
            {/* Two duplicate copies for seamless wrap. The aria-hidden
                on the second copy avoids screen readers reading the
                strings twice — the first copy is the "real" content. */}
            <TickerRow items={items} />
            <TickerRow items={items} ariaHidden />
          </div>

          <style jsx>{`
            @keyframes ticker-scroll {
              from {
                transform: translate3d(0, 0, 0);
              }
              to {
                transform: translate3d(-50%, 0, 0);
              }
            }
            .ticker-track:hover {
              animation-play-state: paused;
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}

function TickerRow({
  items,
  ariaHidden = false,
}: {
  items: readonly string[];
  ariaHidden?: boolean;
}) {
  return (
    <div
      className="flex shrink-0 items-center"
      aria-hidden={ariaHidden || undefined}
    >
      {items.map((s, i) => (
        <span
          key={`${i}-${s}`}
          className="inline-flex items-center text-[13px] text-ink-body whitespace-nowrap"
        >
          {/* Soft divider between items — bullet pattern matches the
              calm typographic language elsewhere on the site. */}
          <span
            aria-hidden="true"
            className="mx-6 inline-block h-1 w-1 rounded-full bg-ink/25"
          />
          {s}
        </span>
      ))}
    </div>
  );
}

function SampleBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-body">
      Sample observations
    </span>
  );
}
