"use client";

// Protection Activated — the emotional resolution screen between
// onboarding and the dashboard.
//
// Two variants:
//   "activated"     — paying user just completed Stripe Checkout.
//                     Copy: "Protection activated. Frugavo is now
//                     watching your accounts." Auto-redirects to
//                     dashboard after the animation hold.
//   "preview"       — free user skipped the upsell. Copy: "Preview
//                     enabled. Activate full protection any time."
//
// Sequence: concern → reassurance. After the reveal puts pressure
// on the user (here's how much you're spending, here's what's
// hidden), this screen relieves that tension. The shield draws in,
// the copy reassures, the dashboard waits.
//
// Used in two places:
//   - /app/welcome (post-reveal, before dashboard)
//   - /app/billing/success (post-payment, before dashboard)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Variant = "activated" | "preview";

type Props = {
  variant: Variant;
  // If provided, we poll this URL (the billing/check endpoint) until
  // the entitlement_state flips to trialing/active, then redirect.
  // If null, we just hold for ~2.5s then redirect.
  pollUrl?: string | null;
  redirectTo?: string;
};

export function ProtectionActivated({
  variant,
  pollUrl = null,
  redirectTo = "/app",
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"drawing" | "settled" | "exiting">(
    "drawing"
  );

  // Hold + redirect choreography. ~600ms of shield draw, then
  // "settled" (text in, breathing), then either poll until activated
  // or hold for 2.5s before transitioning.
  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("settled"), 700);
    let exitTimer: number | null = null;
    let pollTimer: number | null = null;

    if (variant === "preview") {
      exitTimer = window.setTimeout(() => {
        setPhase("exiting");
        window.setTimeout(() => router.push(redirectTo), 350);
      }, 2400);
    } else if (pollUrl) {
      // Paid path — poll the check endpoint until projection lands.
      const tick = async () => {
        try {
          const res = await fetch(pollUrl, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as {
              entitlement_state?: string;
            };
            const s = data.entitlement_state;
            if (s === "trialing" || s === "active") {
              setPhase("exiting");
              window.setTimeout(() => router.push(redirectTo), 600);
              return;
            }
          }
        } catch {
          // ignore — keep polling
        }
        pollTimer = window.setTimeout(tick, 800);
      };
      // Wait until settled phase before starting polling so the
      // animation has time to land.
      const startTimer = window.setTimeout(tick, 900);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(startTimer);
        if (pollTimer) window.clearTimeout(pollTimer);
      };
    } else {
      exitTimer = window.setTimeout(() => {
        setPhase("exiting");
        window.setTimeout(() => router.push(redirectTo), 600);
      }, 2400);
    }

    return () => {
      window.clearTimeout(t1);
      if (exitTimer) window.clearTimeout(exitTimer);
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [variant, pollUrl, redirectTo, router]);

  const headline =
    variant === "activated"
      ? "Protection activated."
      : "Preview enabled.";
  const body =
    variant === "activated"
      ? "Frugavo is now watching your accounts. The first time we catch something, you'll know."
      : "Frugavo will keep an eye on your subscriptions. Activate full protection any time from your dashboard.";

  return (
    <div
      className={[
        "fixed inset-0 bg-ink text-canvas overflow-hidden z-50 transition-opacity duration-500",
        phase === "exiting" ? "opacity-0" : "opacity-100",
      ].join(" ")}
      role="dialog"
      aria-label="Protection status"
    >
      {/* Soft halo */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 h-[60vmin] w-[60vmin] rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: "#10b981" }}
      />

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="text-center max-w-[560px]">
          {/* Shield SVG with draw animation */}
          <svg
            width="84"
            height="84"
            viewBox="0 0 84 84"
            fill="none"
            className="mx-auto"
            aria-hidden="true"
          >
            <path
              d="M42 6 L72 18 L72 42 C72 60 58 74 42 78 C26 74 12 60 12 42 L12 18 Z"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray="280"
              strokeDashoffset={phase === "drawing" ? 280 : 0}
              style={{ transition: "stroke-dashoffset 700ms ease-out" }}
            />
            <path
              d="M30 42 L38 50 L56 32"
              stroke="#10b981"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray="50"
              strokeDashoffset={phase === "drawing" ? 50 : 0}
              style={{
                transition: "stroke-dashoffset 400ms ease-out 600ms",
              }}
            />
          </svg>

          <h1
            className={[
              "mt-7 font-display text-[32px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] transition-all duration-500",
              phase === "drawing"
                ? "opacity-0 translate-y-2"
                : "opacity-100 translate-y-0",
            ].join(" ")}
          >
            {headline}
          </h1>
          <p
            className={[
              "mt-4 text-[15px] md:text-[16px] text-canvas/75 leading-relaxed max-w-[440px] mx-auto transition-all duration-500 delay-150",
              phase === "drawing"
                ? "opacity-0 translate-y-2"
                : "opacity-100 translate-y-0",
            ].join(" ")}
          >
            {body}
          </p>

          {/* Subtle "checks starting" microcopy */}
          <div
            className={[
              "mt-10 flex items-center justify-center gap-2 text-[12px] text-canvas/40 transition-opacity duration-500 delay-500",
              phase === "settled" ? "opacity-100" : "opacity-0",
            ].join(" ")}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            <span>
              {variant === "activated"
                ? "Running first monitoring checks…"
                : "Preparing your dashboard…"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
