"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ScanPhase } from "@/lib/types/scan";

// Cinematic three-state progress arc.
//
// HONESTY CONTRACT:
//   - `phase` is driven ENTIRELY by SSE `progress` events from the
//     engine. There is no wall-clock timer that auto-advances stages.
//   - When SSE hasn't delivered yet, we sit on "connecting" — honest
//     about silence rather than synthesizing fake motion.
//
// MOTION DESIGN:
//   - Outer ring sweeps continuously (the "engine is working" signal).
//     Doesn't advance toward 100%; completion is signalled by the
//     parent unmounting the arc.
//   - Inner counter-rotating ring + center pulse give a sense of
//     compound activity without faking progress.
//   - Three pips below the circle map 1:1 to the SSE phases. They fill
//     as real events arrive. The current pip pulses; passed pips are
//     solid; upcoming pips are hollow.
//   - When the phase prop changes, the label briefly fades out, the
//     text swaps, and the label fades back in. Single mounted node
//     for the label — no absolute positioning, no overlap risk
//     during the crossfade.

type Props = {
  phase?: ScanPhase | null;
  className?: string;
};

// v9 — 5-beat narrative. Each beat carries an UPPERCASE eyebrow, a
// declarative headline, and a factual subtitle. The wait of 15-45
// seconds is real (Plaid sync + detection + classifier) — these
// beats make it feel intentional and set up the welcome reveal as
// the payoff. Copy is honest: every line maps to something the
// engine literally does at that stage.
type Beat = {
  eyebrow: string;
  headline: string;
  subtitle: string;
  // v10 — story lines rotate through every ~4s under the subtitle
  // while the beat is active. Each line is factual and explains
  // something the engine actually does or is true about the
  // recurring-subscription space. Keeps the longer wait
  // (60s+ on first-connect when Plaid is slow) engaging instead of
  // patient.
  story: string[];
};

const PHASE_BEATS: Record<ScanPhase, Beat> = {
  connecting: {
    eyebrow: "CONNECT",
    headline: "Meeting your bank, through Plaid.",
    subtitle:
      "Same secure channel Venmo and Robinhood use. Read-only, never stored.",
    story: [
      "Plaid is used by 11,000+ financial apps including Venmo, Coinbase, and Chime.",
      "Frugavo never sees or stores your bank login. Your credentials stay with Plaid.",
      "We can only read transactions. We can't move money, change settings, or make payments.",
      "Plaid is SOC 2 Type II certified. Frugavo doesn't add new attack surface beyond what Plaid already covers.",
    ],
  },
  reading: {
    eyebrow: "READ",
    headline: "Pulling your transaction history.",
    subtitle:
      "Plaid sends us the last 90 days in batches. We never see your bank login.",
    story: [
      "The average American has 12 active subscriptions and underestimates by ~60%.",
      "Bank descriptors are noisy: APL*BILL, AMZN*MKTP, PADDLE.NET, processor prefixes, store IDs.",
      "Apple Pay and Google Pay route through your card, so recurring charges through them still show up.",
      "Plaid pulls in batches. We keep asking until they're done — first-connect can take up to a minute.",
      "Frugavo reads the descriptor, the amount, the date — never the merchant category from your bank.",
    ],
  },
  spotting: {
    eyebrow: "PATTERN",
    headline: "Looking for charges that repeat.",
    subtitle: "Same merchant, similar amount, a monthly heartbeat.",
    story: [
      "A real subscription bills on a cadence — every 30 days, 14 days, 7 days, or 365 days.",
      "Two charges aren't enough evidence. We want three, or a strong catalog match.",
      "We tolerate ±25% amount drift so usage-based bills (AWS, OpenAI, n8n) still get caught.",
      "Same-day duplicates are collapsed. Three Hydro-Quebec line items on the 15th become one.",
      "Skipped months become 'pauses', not failures. We use the modal interval, not the median.",
    ],
  },
  identifying: {
    eyebrow: "IDENTIFY",
    headline: "Matching descriptors to brands.",
    subtitle:
      "APL*BILL 800-275 becomes Apple. AMZN MKTP becomes Amazon.",
    story: [
      "Curated catalog of 130+ brands. Anything else, we ask Claude to decode the descriptor.",
      "Each merchant tag is checked across users. If someone else's Frugavo already saw it, we reuse the answer.",
      "Streaming, software, news, AI tools, insurance, telecom, mortgage, rent — all classified separately.",
      "Bills (utilities, rent, insurance) are tracked but tagged separately. You can't 'cancel' your mortgage.",
      "Variable spend at Amazon or Starbucks doesn't count as a subscription, even when it's regular.",
    ],
  },
  counting: {
    eyebrow: "COUNT",
    headline: "Adding up what you didn't know.",
    subtitle:
      "About to show you exactly what leaves your accounts every month.",
    story: [
      "Monthly upkeep = sum of confirmed subscriptions normalized to a monthly equivalent.",
      "Annual subscriptions get divided by 12. Weekly ones multiplied by 4.33.",
      "We separate 'cancellable' subs from 'fixed' commitments so you can see what you can act on.",
      "Trial conversions get flagged: the moment a free trial becomes a real charge, we tell you.",
      "Almost done — about to show you the number, and the top charges driving it.",
    ],
  },
};

const STORY_ROTATE_MS = 4000;

// Back-compat label used by aria-label (single short string).
const PHASE_LABEL: Record<ScanPhase, string> = {
  connecting: "Connecting to your bank",
  reading: "Reading transactions",
  spotting: "Looking for recurring patterns",
  identifying: "Identifying merchants",
  counting: "Computing your totals",
};

const PHASE_ORDER: ScanPhase[] = [
  "connecting",
  "reading",
  "spotting",
  "identifying",
  "counting",
];
const CROSSFADE_MS = 220;

export function ProgressArc({ phase, className }: Props) {
  const current: ScanPhase = phase ?? "connecting";
  const currentIdx = PHASE_ORDER.indexOf(current);

  // Single mounted label node. When `current` changes we fade it
  // out, swap the text, and fade it back in — using ONE node so
  // there's no chance of the entering and exiting labels stacking
  // on top of each other during the transition.
  const [displayPhase, setDisplayPhase] = useState<ScanPhase>(current);
  const [visible, setVisible] = useState(true);
  const lastPhaseRef = useRef<ScanPhase>(current);

  // v10 — rotating story line under the subtitle. Cycles through the
  // story array for the CURRENT beat every STORY_ROTATE_MS. Resets to
  // index 0 whenever the beat changes. Independent fade transition so
  // it can update faster than the beat transition.
  const [storyIdx, setStoryIdx] = useState(0);
  const [storyVisible, setStoryVisible] = useState(true);

  useEffect(() => {
    if (current === lastPhaseRef.current) return;
    lastPhaseRef.current = current;
    // Fade out, swap, fade in.
    setVisible(false);
    setStoryIdx(0); // restart story rotation for new beat
    const swapT = window.setTimeout(() => {
      setDisplayPhase(current);
      requestAnimationFrame(() => setVisible(true));
    }, CROSSFADE_MS);
    return () => window.clearTimeout(swapT);
  }, [current]);

  // Rotate the story line on a timer. The rotation cycle is tied to
  // STORY_ROTATE_MS; the engine signals (phase change) reset it.
  useEffect(() => {
    const story = PHASE_BEATS[displayPhase].story;
    if (story.length <= 1) return;
    const tick = window.setInterval(() => {
      setStoryVisible(false);
      window.setTimeout(() => {
        setStoryIdx((i) => (i + 1) % story.length);
        requestAnimationFrame(() => setStoryVisible(true));
      }, CROSSFADE_MS);
    }, STORY_ROTATE_MS);
    return () => window.clearInterval(tick);
  }, [displayPhase]);

  const displayIdx = PHASE_ORDER.indexOf(displayPhase);
  const displayStory =
    PHASE_BEATS[displayPhase].story[
      storyIdx % PHASE_BEATS[displayPhase].story.length
    ];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-7",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={PHASE_LABEL[current]}
    >
      {/* Composition: 3 stacked SVG layers + ambient halo */}
      <div className="relative h-32 w-32">
        {/* Ambient halo — soft brand-tinted radial behind the rings */}
        <div
          className="absolute inset-0 -m-6 rounded-full opacity-60 blur-2xl animate-[halo-breathe_3.2s_ease-in-out_infinite] pointer-events-none"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(16, 185, 129, 0.25), transparent 70%)",
          }}
          aria-hidden="true"
        />

        {/* Outer sweep ring — primary work indicator */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full -rotate-90 will-change-transform"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
              <stop offset="50%" stopColor="currentColor" stopOpacity="0.9" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="text-ink/[0.06]"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="url(#arc-grad)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            className="text-brand origin-center animate-[arc-sweep_1.8s_cubic-bezier(0.65,0,0.35,1)_infinite] will-change-transform"
            strokeDasharray="90 600"
          />
        </svg>

        {/* Inner counter-rotating ring — adds depth + compound motion */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full rotate-90 will-change-transform"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="30"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="3 15"
            className="text-brand/40 origin-center animate-[arc-counter_4.2s_linear_infinite] will-change-transform"
          />
        </svg>

        {/* Center pulse — quiet heartbeat */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="block h-2 w-2 rounded-full bg-brand animate-[pulse-dot_1.4s_ease-in-out_infinite]"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Step pips — real-event-bound. Pip i is FILLED when phase >= i,
          PULSING when phase === i, HOLLOW when ahead of current phase.
          Pure derivation from the phase prop — no timer. */}
      <div className="flex items-center gap-2.5" aria-hidden="true">
        {PHASE_ORDER.map((p, i) => {
          const passed = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <span
              key={p}
              className={cn(
                "block rounded-full transition-all duration-500 ease-out",
                passed && "h-1.5 w-1.5 bg-brand",
                isCurrent &&
                  "h-2 w-2 bg-brand animate-[pulse-dot_1.4s_ease-in-out_infinite]",
                !passed && !isCurrent && "h-1.5 w-1.5 bg-ink/15"
              )}
            />
          );
        })}
      </div>

      {/* v9 — narrative beat: eyebrow + headline + subtitle. Single
          mounted node, crossfade on phase change. Fixed min-h reserves
          space so layout doesn't shift during the transition. The
          subtitle's max-width keeps line-length human (60-65 chars) on
          wide viewports while staying flexible on mobile.
          v10 — rotating story line below the subtitle. Independent
          crossfade keeps the wait engaging across the longer
          first-connect window (up to 60s). */}
      <div className="text-center w-full max-w-[520px]">
        <div
          className="transition-all ease-out"
          style={{
            transitionDuration: `${CROSSFADE_MS}ms`,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(4px)",
            filter: visible ? "blur(0)" : "blur(1.5px)",
          }}
        >
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-brand">
            {PHASE_BEATS[displayPhase].eyebrow}
            <span className="ml-2 text-ink-muted/70 normal-case tracking-normal font-medium">
              · Step {displayIdx + 1} of {PHASE_ORDER.length}
            </span>
          </div>
          <div className="mt-2 text-[20px] md:text-[22px] font-display font-semibold text-ink leading-[1.2]">
            {PHASE_BEATS[displayPhase].headline}
          </div>
          <div className="mt-2.5 text-[13.5px] text-ink-body leading-relaxed">
            {PHASE_BEATS[displayPhase].subtitle}
          </div>
        </div>

        {/* Rotating story line — fades independently of the beat
            transition. Min-h reserves layout so the bar doesn't jump
            when a longer line cycles in. */}
        <div className="mt-5 min-h-[44px]">
          <p
            className="text-[12.5px] text-ink-muted leading-relaxed italic transition-all ease-out"
            style={{
              transitionDuration: `${CROSSFADE_MS}ms`,
              opacity: storyVisible && visible ? 1 : 0,
              transform:
                storyVisible && visible ? "translateY(0)" : "translateY(3px)",
            }}
          >
            {displayStory}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes arc-sweep {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -690; }
        }
        @keyframes arc-counter {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.6; }
        }
        @keyframes halo-breathe {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.08); opacity: 0.75; }
        }
        @media (prefers-reduced-motion: reduce) {
          :global([class*="animate-[arc-sweep"]),
          :global([class*="animate-[arc-counter"]),
          :global([class*="animate-[halo-breathe"]) {
            animation-duration: 8s !important;
          }
          :global([class*="animate-[pulse-dot"]) {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
