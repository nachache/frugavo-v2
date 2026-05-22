"use client";

// UncertainPromptCards — active-learning surface on the dashboard.
//
// Calls /api/scoring/uncertain on mount, shows up to a few candidates
// the model isn't sure about, and lets the user resolve them with
// one tap. Each tap POSTs /api/feedback which both stores the
// override and increments the Beta prior for that merchant.
//
// Empty state: hide the entire section when there's nothing to label.
// That keeps the dashboard clean for users with confident-decisions.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Candidate = {
  subscription_id: string;
  merchant_name: string;
  merchant_key: string;
  category: string;
  amount_cents: number;
  frequency: string;
  occurrences: number;
  last_charge_date: string | null;
  probability: number;
  prior_alpha: number;
  prior_beta: number;
  in_dictionary: boolean;
};

function fmt(c: number): string {
  return `$${(c / 100).toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function prettyFreq(f: string): string {
  const map: Record<string, string> = {
    weekly: "weekly",
    biweekly: "every 2 weeks",
    semi_monthly: "twice a month",
    monthly: "monthly",
    quarterly: "quarterly",
    annually: "annually",
  };
  return map[f] ?? f;
}

export function UncertainPromptCards() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useTransition();
  const [resolving, setResolving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scoring/uncertain?limit=8")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.ok) {
          setError(j.error ?? "unknown_error");
          return;
        }
        setCandidates(j.candidates ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function submit(
    candidate: Candidate,
    overrideType:
      | "confirmed"
      | "not_subscription"
      | "not_recurring"
      | "cancelled"
  ) {
    setResolving((prev) => new Set(prev).add(candidate.subscription_id));
    setSubmitting(async () => {
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription_id: candidate.subscription_id,
            override_type: overrideType,
          }),
        });
        // Remove the card optimistically.
        setCandidates((prev) =>
          (prev ?? []).filter(
            (c) => c.subscription_id !== candidate.subscription_id
          )
        );
        // Refresh the dashboard so totals / lists rebuild.
        router.refresh();
      } finally {
        setResolving((prev) => {
          const next = new Set(prev);
          next.delete(candidate.subscription_id);
          return next;
        });
      }
    });
  }

  // Hide entirely while loading or when there's nothing to ask about.
  if (candidates === null) return null;
  if (candidates.length === 0) return null;
  if (error) return null;

  return (
    <div
      className="rounded-2xl border border-hairline bg-surface p-4 md:p-6 animate-fadeUp"
      style={{ animationDelay: "0.05s" }}
    >
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Help us learn
          </div>
          <div className="mt-1 text-[13px] md:text-[14px] text-ink-body">
            Quick taps on these refine your future scans.
          </div>
        </div>
        <div className="text-[11px] text-ink-muted tabular-nums shrink-0">
          {candidates.length} to review
        </div>
      </div>

      <div className="space-y-3">
        {candidates.map((c) => (
          <CandidateCard
            key={c.subscription_id}
            candidate={c}
            disabled={submitting || resolving.has(c.subscription_id)}
            onSubmit={(type) => submit(c, type)}
          />
        ))}
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  disabled,
  onSubmit,
}: {
  candidate: Candidate;
  disabled: boolean;
  onSubmit: (
    type: "confirmed" | "not_subscription" | "not_recurring" | "cancelled"
  ) => void;
}) {
  const certainty = Math.round(candidate.probability * 100);
  return (
    <div className="rounded-xl border border-hairline bg-canvas/40 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="text-[15px] md:text-[16px] font-semibold text-ink truncate">
              {candidate.merchant_name}
            </div>
            <span className="text-[12px] text-ink-muted tabular-nums">
              {fmt(candidate.amount_cents)}/{prettyFreq(candidate.frequency).split(" ")[0]}
            </span>
          </div>
          <div className="mt-1 text-[12px] md:text-[13px] text-ink-body">
            {candidate.occurrences} charges,{" "}
            {prettyFreq(candidate.frequency)}
            {candidate.last_charge_date && (
              <>
                {" · "}
                last{" "}
                {new Date(candidate.last_charge_date).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" }
                )}
              </>
            )}
          </div>
        </div>
        <div className="text-[11px] text-ink-muted tabular-nums shrink-0">
          {certainty}% confident
        </div>
      </div>

      <div className="mt-3 text-[13px] md:text-[14px] font-medium text-ink">
        Is this a subscription?
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <FeedbackButton
          variant="primary"
          disabled={disabled}
          onClick={() => onSubmit("confirmed")}
        >
          Yes, it&apos;s a subscription
        </FeedbackButton>
        <FeedbackButton
          variant="secondary"
          disabled={disabled}
          onClick={() => onSubmit("not_subscription")}
        >
          Recurring, but not a subscription
        </FeedbackButton>
        <FeedbackButton
          variant="ghost"
          disabled={disabled}
          onClick={() => onSubmit("not_recurring")}
        >
          Not recurring
        </FeedbackButton>
      </div>
    </div>
  );
}

function FeedbackButton({
  variant,
  children,
  disabled,
  onClick,
}: {
  variant: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  const cls =
    variant === "primary"
      ? "bg-ink text-canvas hover:bg-ink/85"
      : variant === "secondary"
        ? "bg-surface text-ink border border-hairline hover:bg-ink/[0.04]"
        : "bg-transparent text-ink-muted border border-transparent hover:text-ink hover:border-hairline";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center h-9 px-3 rounded-full text-[12.5px] md:text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
        cls,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
