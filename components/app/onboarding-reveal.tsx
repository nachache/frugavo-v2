"use client";

// Onboarding reveal — the "holy shit" moment after the first scan.
//
// Instead of dumping the dashboard onto a new user, we walk them
// through their own numbers one stat at a time. Each stage is a
// full-bleed dark screen with one big number and a short caption.
// Stages auto-advance after 3.5s; tap anywhere to skip ahead;
// "Continue" at the end goes to the dashboard.
//
// The choreography is deliberately slow at the start (subscription
// count → monthly burn) so the punchline (yearly spend, shock
// insight) lands with weight. This pattern mirrors Spotify Wrapped:
// pacing builds anticipation, and anticipation is what makes the
// number feel emotional.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  subscriptionCount: number;
  monthlyBurnCents: number;
  yearlyBurnCents: number;
  aiMonthlyCents: number;
  aiCount: number;
  topCategory: { label: string; monthly_cents: number } | null;
  topSubscription: { name: string; monthly_cents: number } | null;
  moneyLeakCount: number;
  shockHeadline: string | null;
  personality: { label: string; sub: string } | null;
};

type Stage = {
  id: string;
  eyebrow: string;
  big: string;
  bigSuffix?: string;
  caption: string;
  accent?: "emerald" | "orange" | "rose" | "violet";
  show: boolean;
};

function fmt(c: number, opts: { withCents?: boolean } = {}): string {
  const v = c / 100;
  if (opts.withCents === false) {
    return `$${Math.round(v).toLocaleString("en-US")}`;
  }
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function OnboardingReveal(props: Props) {
  const router = useRouter();
  const stages = useMemo<Stage[]>(() => {
    const all: Stage[] = [
      {
        id: "count",
        eyebrow: "We scanned every recurring charge",
        big: String(props.subscriptionCount),
        caption:
          props.subscriptionCount === 1
            ? "active subscription found"
            : "active subscriptions found",
        accent: "emerald",
        show: props.subscriptionCount > 0,
      },
      {
        id: "monthly",
        eyebrow: "You spend",
        big: fmt(props.monthlyBurnCents, { withCents: false }),
        bigSuffix: "/mo",
        caption: "on subscriptions, every single month",
        accent: "emerald",
        show: props.monthlyBurnCents > 0,
      },
      {
        id: "yearly",
        eyebrow: "That's",
        big: fmt(props.yearlyBurnCents, { withCents: false }),
        bigSuffix: "/yr",
        caption: "leaving your account on autopilot",
        accent: "orange",
        show: props.yearlyBurnCents > 0,
      },
      {
        id: "ai",
        eyebrow: "Your AI stack alone costs",
        big: fmt(props.aiMonthlyCents, { withCents: false }),
        bigSuffix: "/mo",
        caption:
          props.aiCount === 1
            ? "1 AI subscription running"
            : `${props.aiCount} AI subscriptions running`,
        accent: "violet",
        show: props.aiCount > 0,
      },
      {
        id: "category",
        eyebrow: "Most of your subscription money goes to",
        big: props.topCategory?.label ?? "—",
        caption: props.topCategory
          ? `${fmt(props.topCategory.monthly_cents, { withCents: false })}/mo across this category`
          : "",
        accent: "emerald",
        show: !!props.topCategory && props.topCategory.monthly_cents > 0,
      },
      {
        id: "biggest_sub",
        eyebrow: "Your biggest subscription",
        big: props.topSubscription?.name ?? "—",
        caption: props.topSubscription
          ? `${fmt(props.topSubscription.monthly_cents)}/mo`
          : "",
        accent: "orange",
        show: !!props.topSubscription,
      },
      {
        id: "leaks",
        eyebrow: "We spotted",
        big: String(props.moneyLeakCount),
        caption:
          props.moneyLeakCount === 1
            ? "possible money leak. You can review it now."
            : "possible money leaks. You can review them now.",
        accent: "rose",
        show: props.moneyLeakCount > 0,
      },
      {
        id: "shock",
        eyebrow: "And one more thing",
        big: props.shockHeadline ?? "",
        caption: "",
        accent: "violet",
        show: !!props.shockHeadline,
      },
      {
        id: "identity",
        eyebrow: "Your subscription personality",
        big: props.personality?.label ?? "—",
        caption: props.personality?.sub ?? "",
        accent: "emerald",
        show: !!props.personality,
      },
    ];
    return all.filter((s) => s.show);
  }, [props]);

  const [idx, setIdx] = useState(0);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-advance.
  useEffect(() => {
    if (exiting) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (idx >= stages.length - 1) return; // last stage waits for tap
    // Slightly longer for the first stage (let the brain catch up).
    const ms = idx === 0 ? 3800 : 3300;
    timerRef.current = setTimeout(() => {
      setIdx((i) => Math.min(i + 1, stages.length - 1));
    }, ms);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idx, stages.length, exiting]);

  function next() {
    if (exiting) return;
    if (idx < stages.length - 1) {
      setIdx((i) => i + 1);
    } else {
      setExiting(true);
      router.push("/app");
    }
  }

  function skipAll() {
    setExiting(true);
    router.push("/app");
  }

  if (stages.length === 0) {
    // No data — just bounce to the dashboard.
    router.push("/app");
    return null;
  }

  const current = stages[idx];
  const isLast = idx === stages.length - 1;

  return (
    <div
      onClick={next}
      className="fixed inset-0 bg-ink text-canvas overflow-hidden cursor-pointer select-none z-50"
      role="dialog"
      aria-label="Subscription reveal"
    >
      {/* Halo background tied to accent */}
      <AccentHalo accent={current.accent ?? "emerald"} />

      {/* Top brand + skip */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-5 md:p-7 z-10">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-brand" />
          <span className="text-[14px] font-semibold tracking-[-0.2px]">Frugavo</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            skipAll();
          }}
          className="text-[12px] text-canvas/60 hover:text-canvas transition"
        >
          Skip
        </button>
      </div>

      {/* Progress dots */}
      <div className="absolute top-14 md:top-16 left-0 right-0 px-5 md:px-7 flex gap-1 z-10">
        {stages.map((s, i) => (
          <div
            key={s.id}
            className={[
              "h-1 flex-1 rounded-full overflow-hidden transition-all duration-500",
              i < idx ? "bg-canvas/40" : "bg-canvas/10",
            ].join(" ")}
          >
            {i === idx && (
              <div
                key={`fill-${s.id}-${idx}`}
                className="h-full bg-canvas/80 animate-progressFill"
                style={{ animationDuration: idx === 0 ? "3.8s" : "3.3s" }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Stage content */}
      <div className="absolute inset-0 flex items-center justify-center px-6 md:px-10">
        <div
          key={current.id}
          className="text-center max-w-[800px] mx-auto animate-revealUp"
        >
          <div className="text-[12px] md:text-[14px] font-medium uppercase tracking-[0.18em] text-canvas/55">
            {current.eyebrow}
          </div>
          <div
            className={[
              "mt-5 md:mt-8 font-display font-bold tracking-[-0.04em] leading-[0.95] tabular-nums break-words",
              // size scales by string length so long identity labels still fit
              current.big.length > 18
                ? "text-[44px] sm:text-[56px] md:text-[80px]"
                : current.big.length > 11
                  ? "text-[64px] sm:text-[88px] md:text-[120px]"
                  : "text-[80px] sm:text-[120px] md:text-[180px]",
            ].join(" ")}
          >
            {current.big}
            {current.bigSuffix && (
              <span className="text-[40%] font-medium text-canvas/55 ml-1">
                {current.bigSuffix}
              </span>
            )}
          </div>
          {current.caption && (
            <div className="mt-5 md:mt-7 text-[15px] md:text-[18px] text-canvas/80 max-w-[640px] mx-auto leading-relaxed">
              {current.caption}
            </div>
          )}
          {isLast && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="mt-10 md:mt-14 inline-flex items-center gap-2 h-12 px-7 rounded-full bg-canvas text-ink font-medium text-[14px] hover:bg-canvas/90 transition"
            >
              View your dashboard
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tap-anywhere hint */}
      {!isLast && (
        <div className="absolute bottom-6 md:bottom-8 left-0 right-0 text-center text-[12px] text-canvas/40">
          Tap to continue
        </div>
      )}
    </div>
  );
}

function AccentHalo({ accent }: { accent: "emerald" | "orange" | "rose" | "violet" }) {
  const colorTop = {
    emerald: "#10b981",
    orange: "#f97316",
    rose: "#fb7185",
    violet: "#a78bfa",
  }[accent];
  const colorBot = {
    emerald: "#047857",
    orange: "#ea580c",
    rose: "#dc2626",
    violet: "#7c3aed",
  }[accent];
  return (
    <>
      <div
        className="absolute -top-40 -right-40 h-[60vmin] w-[60vmin] rounded-full opacity-30 blur-3xl pointer-events-none transition-all duration-700"
        style={{ background: colorTop }}
      />
      <div
        className="absolute -bottom-40 -left-40 h-[50vmin] w-[50vmin] rounded-full opacity-25 blur-3xl pointer-events-none transition-all duration-700"
        style={{ background: colorBot }}
      />
    </>
  );
}
