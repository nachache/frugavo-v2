"use client";

import { useEffect, useState } from "react";

// AppIntro — first-paint splash that appears once per session.
//
// Mounted at the top of /app. Overlay-only — the dashboard renders
// behind it so we never block hydration. Visual choreography:
//
//   t=0      mark fades up + slight scale
//   t=180ms  "Hi, {Name}." fades in
//   t=320ms  subtitle ("Here's your subscription analysis.") fades in
//   t=1750ms whole overlay starts to dissolve
//   t=2200ms unmount
//
// The hold between subtitle-in (t≈920ms when its 0.6s animation
// finishes) and dissolve-start (t=1750ms) gives the user about
// 830ms to actually read the greeting — long enough for a calm
// moment, short enough that it never feels like a loading screen.
//
// One-shot per browser session (sessionStorage). Returning to the
// dashboard later in the same tab does NOT replay it — the feeling
// we're after is "I just opened the app," not "the app is loading."
//
// Honors prefers-reduced-motion by skipping the animation and
// unmounting instantly.

type Props = {
  firstName?: string | null;
};

const SESSION_KEY = "frugavo:app-intro-shown";
const INTRO_DURATION_MS = 2200;
const DISSOLVE_START_MS = 1750;

export function AppIntro({ firstName }: Props) {
  const [phase, setPhase] = useState<"hidden" | "visible" | "dissolving">(
    "hidden"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    // One-shot guard. The same tab on the same day never sees it
    // twice; opening a new tab next day does.
    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      /* swallow */
    }
    if (alreadyShown) return;

    // Reduced motion: skip entirely.
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* swallow */
      }
      return;
    }

    // Lock body scroll while the overlay is up so a scroll wheel
    // tick doesn't show the user the dashboard half-revealed.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    setPhase("visible");

    const dissolveTimer = setTimeout(() => {
      setPhase("dissolving");
    }, DISSOLVE_START_MS);
    const unmountTimer = setTimeout(() => {
      setPhase("hidden");
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* swallow */
      }
      document.body.style.overflow = previousOverflow;
    }, INTRO_DURATION_MS);

    return () => {
      clearTimeout(dissolveTimer);
      clearTimeout(unmountTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (phase === "hidden") return null;

  // Personalized greeting. We use a calm "Hi, {Name}" rather than
  // the louder "Welcome back" — Welcome Back is Slack's emotional
  // beat, ours is quieter intelligence.
  const greeting = firstName ? `Hi, ${firstName}.` : "Hi.";

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at center, #FAF8F4 0%, #FAF8F4 50%, rgba(250,248,244,0.92) 100%)",
        opacity: phase === "dissolving" ? 0 : 1,
        transition: `opacity ${
          INTRO_DURATION_MS - DISSOLVE_START_MS
        }ms cubic-bezier(0.16, 1, 0.3, 1)`,
      }}
    >
      <div
        className="flex flex-col items-center"
        style={{
          opacity: phase === "dissolving" ? 0 : 1,
          transform:
            phase === "dissolving"
              ? "translateY(-8px) scale(0.985)"
              : "translateY(0) scale(1)",
          transition: `opacity ${
            INTRO_DURATION_MS - DISSOLVE_START_MS
          }ms cubic-bezier(0.16, 1, 0.3, 1), transform ${
            INTRO_DURATION_MS - DISSOLVE_START_MS
          }ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
      >
        {/* Brand mark — ink-black circle with the Frugavo F dot.
            Renders as SVG so it's crisp at any DPI; matches the PWA
            icon shape exactly. */}
        <div
          className="inline-flex items-center justify-center"
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            background: "#0A0A0A",
            boxShadow: "0 12px 40px -16px rgba(10, 10, 10, 0.4)",
            animation: "fr-intro-mark-in 0.65s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            {/* Stack-of-discs glyph mirrors the existing avatar mark. */}
            <ellipse cx="16" cy="11" rx="9" ry="2.6" fill="#047857" />
            <ellipse cx="16" cy="17" rx="9" ry="2.6" fill="#FAFAFA" />
            <ellipse cx="16" cy="23" rx="9" ry="2.6" fill="#FAFAFA" opacity="0.92" />
          </svg>
        </div>

        {/* Greeting — fades in just after the mark lands. */}
        <h2
          className="mt-6 font-display text-[22px] md:text-[26px] font-semibold tracking-[-0.02em] text-ink leading-tight"
          style={{
            animation:
              "fr-intro-text-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.18s both",
          }}
        >
          {greeting}
        </h2>

        {/* Subtitle — sets the emotional tone. */}
        <p
          className="mt-1 text-[13px] md:text-[14px] text-ink-muted"
          style={{
            animation:
              "fr-intro-text-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.32s both",
          }}
        >
          Here&apos;s your subscription analysis.
        </p>
      </div>

      {/* Local keyframes — kept inline so the component is fully
          self-contained and there's no globals.css coupling. */}
      <style>{`
        @keyframes fr-intro-mark-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.94);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes fr-intro-text-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
