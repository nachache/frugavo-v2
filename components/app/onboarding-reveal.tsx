"use client";

// Onboarding reveal — the cinematic post-scan experience.
//
// Two stages, not nine. The full 4-step user journey is:
//
//   1. Connecting accounts   — handled at /app/connect (Plaid Link)
//   2. Scanning progress     — handled by the live scanning UI
//   3. Reveal                — THIS COMPONENT, stage 1: the climax.
//                              All the key numbers on a single big
//                              screen, framed as a unified moment.
//   4. Protection activation — THIS COMPONENT, stage 2: the
//                              commercial moment. One CTA, one
//                              personalized line about what we'd
//                              catch if they keep us watching.
//
// After stage 2:
//   - "Activate Protection" → /api/billing/checkout → Stripe → success
//   - "Continue without protection" → ProtectionActivated(preview) → /app
//
// Why this restructure: the old 9-slide flow fragmented the reveal
// into bite-sized stats that each landed individually. The result
// is the climax never lands — every slide feels like one of many.
// One unified Reveal screen + one Upsell screen produces:
//
//   concern (reveal) → reassurance (upsell) → resolution (activated)
//
// That arc is what converts.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectionActivated } from "./protection-activated";

type Props = {
  subscriptionCount: number;
  monthlyBurnCents: number;
  yearlyBurnCents: number;
  aiMonthlyCents: number;
  aiCount: number;
  topCategory: { label: string; monthly_cents: number } | null;
  topSubscription: { name: string; monthly_cents: number } | null;
  moneyLeakCount: number;
  personality: { label: string; sub: string } | null;
  // Personalized upsell hook. Built server-side from monitoring
  // alerts (preferred) or a derived fallback. Always non-empty —
  // the page guarantees a calm fallback like "We'll watch for
  // unusual recurring charges automatically."
  protectionPitch: string;
  firstName: string | null;
};

function fmtBig(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

function fmt(c: number): string {
  const v = c / 100;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function OnboardingReveal(props: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<"reveal" | "upsell" | "preview">(
    "reveal"
  );
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setActivating(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError("Couldn't open checkout — please try again.");
        setActivating(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't open checkout — please try again.");
      setActivating(false);
    }
  }

  // Continue without activating — show the "Preview enabled"
  // transition for ~2.5s, then drop into the dashboard.
  if (stage === "preview") {
    return <ProtectionActivated variant="preview" />;
  }

  if (stage === "upsell") {
    return (
      <RevealShell>
        <div className="text-center max-w-[640px] mx-auto animate-revealUp">
          <div className="text-[12px] md:text-[14px] font-medium uppercase tracking-[0.18em] text-canvas/55">
            One last thing
          </div>
          <h1 className="mt-5 md:mt-7 font-display text-[34px] md:text-[60px] font-bold tracking-[-0.03em] leading-[1.05]">
            Want us to keep watching?
          </h1>
          <p className="mt-4 md:mt-5 text-[15px] md:text-[18px] text-canvas/85 leading-relaxed max-w-[540px] mx-auto">
            {props.protectionPitch}
          </p>

          <div className="mt-7 md:mt-9 grid grid-cols-1 gap-2.5 text-left text-[13px] md:text-[14px] text-canvas/80 max-w-[420px] mx-auto">
            <Bullet>Daily monitoring across every connected account</Bullet>
            <Bullet>Heads-up before any trial converts to a paid charge</Bullet>
            <Bullet>Price-hike alerts on subscriptions that quietly increase</Bullet>
            <Bullet>Flagged duplicates and dormant charges that resume</Bullet>
          </div>

          <div className="mt-8 md:mt-10 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={activate}
              disabled={activating}
              className="inline-flex items-center justify-center gap-2 h-12 md:h-14 px-7 md:px-9 rounded-full bg-brand text-white font-semibold text-[15px] md:text-[16px] hover:bg-brand-hover transition disabled:opacity-70 disabled:cursor-wait"
            >
              {activating ? "Opening checkout…" : "Activate Protection"}
              {!activating && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
            <div className="text-[12px] md:text-[12.5px] text-canvas/55">
              7 days free. $14.99/mo after. Cancel anytime.
            </div>
            <button
              type="button"
              onClick={() => setStage("preview")}
              className="mt-2 text-[13px] text-canvas/55 hover:text-canvas/90 underline-offset-4 hover:underline transition"
            >
              Continue without protection
            </button>
          </div>

          {error && (
            <p className="mt-4 text-[12.5px] text-danger">{error}</p>
          )}
        </div>
      </RevealShell>
    );
  }

  // Stage 1 — REVEAL. One unified screen, all the key numbers.
  const greeting = props.firstName
    ? `Hey ${props.firstName} —`
    : "Here's what we found.";
  const personalityLabel = props.personality?.label ?? "—";

  return (
    <RevealShell>
      <div className="text-center max-w-[820px] mx-auto px-1 animate-revealUp">
        <div className="text-[12px] md:text-[14px] font-medium uppercase tracking-[0.18em] text-canvas/55">
          {greeting}
        </div>

        {/* Personality — the lead identity statement */}
        <h1 className="mt-3 md:mt-5 font-display font-bold tracking-[-0.03em] leading-[1.02] text-[36px] sm:text-[56px] md:text-[80px]">
          you&apos;re the
          <br />
          <span className="text-brand">{personalityLabel}</span>
        </h1>
        {props.personality?.sub && (
          <p className="mt-3 md:mt-4 text-[14px] md:text-[17px] text-canvas/75 leading-relaxed max-w-[600px] mx-auto">
            {props.personality.sub}
          </p>
        )}

        {/* Stats grid — the receipt */}
        <div className="mt-9 md:mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-[760px] mx-auto">
          <Stat
            label="Monthly"
            big={fmtBig(props.monthlyBurnCents)}
            accent
          />
          <Stat
            label="Yearly"
            big={fmtBig(props.yearlyBurnCents)}
          />
          <Stat
            label="Active charges"
            big={String(props.subscriptionCount)}
          />
          {props.aiCount > 0 ? (
            <Stat
              label="AI stack"
              big={fmtBig(props.aiMonthlyCents)}
              suffix="/mo"
            />
          ) : props.topCategory ? (
            <Stat
              label="Top category"
              big={props.topCategory.label}
              compact
            />
          ) : (
            <Stat
              label="Money leaks"
              big={String(props.moneyLeakCount)}
            />
          )}
        </div>

        {/* Biggest line item — the visceral one */}
        {props.topSubscription && (
          <div className="mt-7 md:mt-9 inline-flex items-center gap-2 text-[13px] md:text-[14px] text-canvas/65">
            <span>Biggest single charge:</span>
            <span className="font-medium text-canvas">
              {props.topSubscription.name}
            </span>
            <span className="text-canvas/55">·</span>
            <span className="tabular-nums text-canvas">
              {fmt(props.topSubscription.monthly_cents)}/mo
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setStage("upsell")}
          className="mt-10 md:mt-14 inline-flex items-center gap-2 h-12 px-7 rounded-full bg-canvas text-ink font-medium text-[14px] hover:bg-canvas/90 transition"
        >
          Continue
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </RevealShell>
  );
}

function RevealShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 bg-ink text-canvas overflow-y-auto select-none z-50"
      role="dialog"
      aria-label="Subscription reveal"
    >
      {/* Soft halo */}
      <div
        className="absolute -top-40 -right-40 h-[60vmin] w-[60vmin] rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: "#10b981" }}
      />
      <div
        className="absolute -bottom-40 -left-40 h-[50vmin] w-[50vmin] rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: "#047857" }}
      />

      {/* Top brand */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-5 md:p-7 z-10">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-brand" />
          <span className="text-[14px] font-semibold tracking-[-0.2px]">
            Frugavo
          </span>
        </div>
      </div>

      <div className="relative min-h-full flex items-center justify-center py-20 px-6 md:px-10">
        {children}
      </div>
    </div>
  );
}

function Stat({
  label,
  big,
  suffix,
  accent,
  compact,
}: {
  label: string;
  big: string;
  suffix?: string;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-canvas/10 bg-canvas/[0.04] px-3.5 py-4 md:px-5 md:py-5 text-left">
      <div className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-canvas/55">
        {label}
      </div>
      <div
        className={[
          "mt-1.5 font-display font-bold tracking-[-0.02em] tabular-nums leading-tight",
          accent ? "text-brand" : "text-canvas",
          compact
            ? "text-[18px] md:text-[22px]"
            : "text-[22px] md:text-[34px]",
        ].join(" ")}
      >
        {big}
        {suffix && (
          <span className="text-[55%] font-medium text-canvas/55 ml-0.5">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand shrink-0"
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
}
