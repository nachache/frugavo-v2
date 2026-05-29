"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { track } from "@/lib/learning/track";

// InsightFeedbackChip — small 👍/👎 on insight surfaces.
//
// One vote per (user, insight_key). Enforced server-side via a
// unique constraint; client-side via localStorage so a user who
// already voted doesn't see the chip again on returns.
//
// Phase 1 surfaces: concentration line, money leaks rows.
// Phase 2 adds: badges, shock insights, what-changed rows.
//
// On 👍 → submit and collapse to a small "Thanks" pulse.
// On 👎 → expand a reason picker. Selecting a reason submits.
//
// The local "already voted" check uses localStorage, not the
// server, so a returning user doesn't have to wait for a fetch
// to know whether to render the chip. Worst case if the
// localStorage is cleared: the user sees the chip, taps it, the
// unique constraint kicks in server-side, and we return
// already_voted=true silently.

type Reason =
  | "incorrect"
  | "not_relevant"
  | "already_knew"
  | "not_actionable"
  | "other";

const REASONS: { value: Reason; label: string }[] = [
  { value: "incorrect", label: "Incorrect" },
  { value: "not_relevant", label: "Not relevant" },
  { value: "already_knew", label: "Already knew this" },
  { value: "not_actionable", label: "Not actionable" },
  { value: "other", label: "Other" },
];

type Props = {
  // 'concentration' | 'money_leak' | 'shock' | 'badge' | etc.
  insightKind: string;
  // Stable identifier for THIS specific insight instance. The pair
  // (user, insightKey) is the unique constraint on the DB side.
  insightKey: string;
  // Optional inline class so callers can position the chip.
  className?: string;
};

function localStorageKey(insightKey: string): string {
  return `frugavo:insight-voted:${insightKey}`;
}

export function InsightFeedbackChip({
  insightKind,
  insightKey,
  className = "",
}: Props) {
  const [voted, setVoted] = useState<"pending" | "yes" | "no" | "done">(
    "pending"
  );
  const [reasonOpen, setReasonOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Read prior vote from localStorage on mount. SSR hydration safe:
  // first paint shows nothing (voted = 'pending'), then we either
  // collapse the chip (already voted) or show it.
  useEffect(() => {
    try {
      const prior = window.localStorage.getItem(localStorageKey(insightKey));
      if (prior === "yes" || prior === "no") setVoted("done");
    } catch {
      /* swallow */
    }
  }, [insightKey]);

  async function submit(vote: 1 | -1, reason: Reason | null = null) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/learning/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "insight",
          payload: {
            insight_kind: insightKind,
            insight_key: insightKey,
            vote,
            reason,
          },
        }),
      });
      try {
        window.localStorage.setItem(
          localStorageKey(insightKey),
          vote === 1 ? "yes" : "no"
        );
      } catch {
        /* swallow */
      }
      track("insight_vote_submitted", {
        insight_kind: insightKind,
        vote,
        reason: reason ?? "",
      });
      setVoted(vote === 1 ? "yes" : "no");
      setReasonOpen(false);
      // Collapse to the "done" state shortly after the success
      // pulse so the chip melts away rather than lingering.
      setTimeout(() => setVoted("done"), 1400);
    } catch {
      // Silent — feedback failures are non-fatal by design. Reset
      // so the user can retry.
      setSubmitting(false);
    }
  }

  if (voted === "done") return null;

  if (voted === "yes" || voted === "no") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11.5px] text-brand ${className}`}
        aria-live="polite"
      >
        <Check size={11} strokeWidth={2.6} />
        <span>Thanks</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {reasonOpen ? (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={submitting}
              onClick={() => submit(-1, r.value)}
              className="inline-flex items-center rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] transition px-2 h-6 text-[11px] text-ink-body disabled:opacity-60"
            >
              {r.label}
            </button>
          ))}
        </span>
      ) : (
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit(1)}
            aria-label="This insight is useful"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-ink-muted hover:text-brand hover:bg-brand/10 transition disabled:opacity-60"
          >
            <ThumbsUp size={12} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setReasonOpen(true)}
            aria-label="This insight is not useful"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-ink-muted hover:text-danger hover:bg-danger/10 transition disabled:opacity-60"
          >
            <ThumbsDown size={12} strokeWidth={2.2} />
          </button>
        </>
      )}
    </span>
  );
}
