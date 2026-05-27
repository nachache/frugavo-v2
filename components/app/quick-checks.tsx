"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import type { OpenDoubt } from "@/lib/doubt/load";

// QuickChecks — single-question carousel.
//
// Replaces the earlier 5-row list with a focused, one-question-at-a-time
// UX. Reasoning:
//   - The user only ever sees ONE question, in the same fixed location
//     on the dashboard. The card height + outer position never change,
//     so successive answers feel like ONE place updating, not a queue
//     ticking down.
//   - Buttons have intentional micro-feedback: press-scale, success
//     pulse, slide-and-fade between questions. The act of answering
//     should feel like a small win, not a form submission.
//   - Progress dots make the loop legible without surfacing all the
//     pending questions at once — "5 of 7" with a row of dots is
//     enough.
//
// Resolution flow:
//   tap chip → optimistic local advance + small "✓" pulse →
//   POST /api/doubt/:id/{resolve|dismiss} →
//   slide next question in →
//   on last question answered: brief celebration → router.refresh()
//
// Same API as before. Telemetry surface is still 'dashboard_module'.

type Props = {
  items: OpenDoubt[];
};

type ResolutionChoice =
  | "confirmed"
  | "not_sub"
  | "shared"
  | "work"
  | "family";

export function QuickChecks({ items: initialItems }: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState<OpenDoubt[]>(initialItems);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitionDir, setTransitionDir] = useState<"in" | "out">("in");
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const totalShown = useMemo(() => initialItems.length, [initialItems.length]);

  // Hide entirely once the user has answered every question. The
  // celebration moment is a brief beat (~900ms) before the section
  // unmounts.
  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => {
        startTransition(() => router.refresh());
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [allDone, router]);

  if (queue.length === 0 && !allDone) return null;

  const current = queue[activeIndex] ?? null;
  const answered = totalShown - queue.length;
  const progress = `${Math.min(answered + 1, totalShown)} of ${totalShown}`;

  function advanceTo(nextIndex: number, removedId: string) {
    setTransitionDir("out");
    // Pulse the success state briefly, then swap in the next question.
    setPulseId(removedId);
    setTimeout(() => {
      setQueue((prev) => prev.filter((q) => q.id !== removedId));
      setActiveIndex(0); // always show the head of the queue
      setTransitionDir("in");
      setPulseId(null);
      // If the queue had exactly one item and we just answered it,
      // flip into "all done" celebration mode.
      if (nextIndex >= queue.length - 1) {
        if (queue.length <= 1) setAllDone(true);
      }
    }, 280);
  }

  async function send(
    doubt: OpenDoubt,
    endpoint: "resolve" | "dismiss",
    resolution: ResolutionChoice | null
  ) {
    setErrorIds((prev) => {
      const next = new Set(prev);
      next.delete(doubt.id);
      return next;
    });
    try {
      const body: Record<string, string> = { surface: "dashboard_module" };
      if (resolution) body.resolution = resolution;
      const res = await fetch(`/api/doubt/${doubt.id}/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      advanceTo(activeIndex, doubt.id);
    } catch {
      setErrorIds((prev) => {
        const next = new Set(prev);
        next.add(doubt.id);
        return next;
      });
    }
  }

  return (
    <section
      className="rounded-2xl border border-hairline bg-surface p-5 md:p-6"
      aria-labelledby="quick-checks-heading"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[11.5px] md:text-[12px] font-medium uppercase tracking-[0.1em] text-ink-muted">
            <Sparkles size={12} strokeWidth={2.2} className="text-brand" />
            Quick check
          </div>
          <h2
            id="quick-checks-heading"
            className="mt-1.5 font-display text-[16.5px] md:text-[18px] font-semibold tracking-[-0.015em] text-ink leading-tight"
          >
            {allDone
              ? "You're all caught up."
              : "Help Frugavo understand your subscriptions better."}
          </h2>
        </div>
        {totalShown > 1 && !allDone ? (
          <div className="shrink-0 text-right">
            <div className="text-[11px] text-ink-muted tabular-nums">
              {progress}
            </div>
            <ProgressDots
              total={totalShown}
              done={answered}
              className="mt-1.5"
            />
          </div>
        ) : null}
      </header>

      {/* Fixed-height question slot — the card never reflows as
          questions advance. This is what makes successive answers
          feel like ONE location updating. */}
      <div className="mt-5 md:mt-6 min-h-[176px] md:min-h-[160px] relative">
        {allDone ? (
          <AllDoneCelebration count={totalShown} />
        ) : current ? (
          <QuestionCard
            key={current.id}
            doubt={current}
            transitionDir={transitionDir}
            pulsing={pulseId === current.id}
            errored={errorIds.has(current.id)}
            onAnswer={(resolution) =>
              send(current, "resolve", resolution)
            }
            onSkip={() => send(current, "dismiss", null)}
          />
        ) : null}
      </div>

      <style jsx>{`
        @keyframes qslideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes qslideOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-10px);
          }
        }
        @keyframes qpulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.04);
            opacity: 0.9;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Single question card.
// ──────────────────────────────────────────────────────────────────────

function QuestionCard({
  doubt,
  transitionDir,
  pulsing,
  errored,
  onAnswer,
  onSkip,
}: {
  doubt: OpenDoubt;
  transitionDir: "in" | "out";
  pulsing: boolean;
  errored: boolean;
  onAnswer: (r: ResolutionChoice) => void;
  onSkip: () => void;
}) {
  const amount = useMemo(
    () => formatAmount(doubt.display.amount_cents, doubt.display.currency),
    [doubt.display.amount_cents, doubt.display.currency]
  );
  const cadence = useMemo(
    () => prettyCadence(doubt.display.frequency),
    [doubt.display.frequency]
  );
  const lastDate = useMemo(
    () => formatDate(doubt.display.last_charged_at),
    [doubt.display.last_charged_at]
  );

  return (
    <div
      style={{
        animation:
          transitionDir === "in"
            ? "qslideIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both"
            : pulsing
              ? "qpulse 260ms ease-out both"
              : "qslideOut 260ms ease-in both",
      }}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[18px] md:text-[20px] font-display font-semibold tracking-[-0.015em] text-ink">
          {doubt.display.merchant_name}
        </span>
        <span className="text-[13.5px] text-ink-body tabular-nums">
          {amount} · {cadence}
        </span>
        {lastDate ? (
          <span className="text-[12px] text-ink-muted tabular-nums">
            last {lastDate}
          </span>
        ) : null}
        {doubt.auto_promoted_at || doubt.confidence < 0.55 ? (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-ink/[0.04] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-muted"
            title={
              doubt.auto_promoted_at
                ? "Auto-promoted after 7 days without an answer."
                : "Engine was less certain about this one."
            }
          >
            unsure
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-[13.5px] text-ink-muted">
        Is this a real recurring subscription?
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <ChipButton
          variant="primary"
          onClick={() => onAnswer("confirmed")}
          icon={<Check size={13} strokeWidth={2.6} />}
        >
          Yes, it's mine
        </ChipButton>
        <ChipButton onClick={() => onAnswer("not_sub")}>Not a sub</ChipButton>
        <ChipButton onClick={() => onAnswer("shared")}>Shared</ChipButton>
        <ChipButton onClick={() => onAnswer("work")}>Work</ChipButton>
        <ChipButton onClick={() => onAnswer("family")}>Family</ChipButton>
        <ChipButton variant="ghost" onClick={onSkip}>
          Skip
        </ChipButton>
      </div>

      {errored ? (
        <p className="mt-2 text-[11.5px] text-danger">
          Couldn&apos;t save that — try again.
        </p>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Satisfying chip button. Three intentional micro-interactions:
//   - hover: subtle background lift
//   - press (active): scale 0.96 for tactile press feedback
//   - default vs primary vs ghost: visual hierarchy without screaming
//
// Uses Tailwind's active:scale utility; the transition is purely CSS
// so there's no JS work on the press path → feels instant.
// ──────────────────────────────────────────────────────────────────────

function ChipButton({
  children,
  onClick,
  variant,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost";
  icon?: React.ReactNode;
}) {
  const variantCls =
    variant === "primary"
      ? "bg-ink text-canvas hover:bg-ink/85 border-ink shadow-[0_1px_2px_rgba(10,10,10,0.12)]"
      : variant === "ghost"
        ? "bg-transparent text-ink-muted hover:text-ink hover:bg-ink/[0.04] border-transparent"
        : "bg-canvas/60 text-ink hover:bg-canvas border-hairline hover:border-ink/20";

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 h-9 md:h-10 px-3.5 md:px-4 rounded-full text-[13px] md:text-[13.5px] font-medium border " +
        "transition-all duration-150 ease-out " +
        "active:scale-[0.96] active:duration-75 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 " +
        variantCls
      }
    >
      {icon}
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Progress dots — small visual rhythm above the card. Done dots are
// filled brand-color; pending are hairline-only.
// ──────────────────────────────────────────────────────────────────────

function ProgressDots({
  total,
  done,
  className,
}: {
  total: number;
  done: number;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={
            "block h-1.5 w-1.5 rounded-full transition-colors duration-300 " +
            (i < done
              ? "bg-brand"
              : i === done
                ? "bg-ink/40"
                : "bg-ink/10")
          }
        />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// All-done celebration. Brief beat (~1.4s) before the section
// unmounts via router.refresh. Keeps the user in the same location
// while the dashboard re-fetches.
// ──────────────────────────────────────────────────────────────────────

function AllDoneCelebration({ count }: { count: number }) {
  return (
    <div
      className="flex items-center justify-center h-full text-center"
      style={{
        animation: "qslideIn 380ms cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Check size={22} strokeWidth={2.6} />
        </div>
        <p className="mt-3 text-[14px] text-ink-body">
          Thanks — {count} {count === 1 ? "answer" : "answers"} recorded.
        </p>
        <p className="text-[12px] text-ink-muted mt-0.5">
          Your dashboard is updating.
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────────────────────────────

function formatAmount(cents: number, currency: string): string {
  const abs = Math.abs(cents) / 100;
  const sym = currency === "USD" || currency === "CAD" ? "$" : "";
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${formatted}`;
}

function prettyCadence(f: string): string {
  return f.replace(/_/g, " ");
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}
