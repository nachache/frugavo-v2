"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X, Send, Check } from "lucide-react";

// FounderFeedbackChip — always-visible "Talk to Nabil" affordance.
//
// Footer position on /app dashboard. Calm and small. Opens a soft
// modal with a single textarea + Send. Submissions route through
// /api/learning/feedback (kind=founder_modal) which fans out to:
//   1. INSERT feedback_freeform (source of truth)
//   2. Email to hello@ + OPS_NOTIFY_EMAILS
//   3. Slack webhook (if configured)
//
// Strategic choice — labeled "Talk to Nabil" instead of "Send
// feedback." Early-beta users respond to a person, not a form.
// When we eventually have multiple founders / a support team, this
// label rotates / becomes "Talk to the team."

const STORAGE_KEY_LAST_SEND = "frugavo:founder-feedback:last-sent-at";

export function FounderFeedbackChip() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss the "Thanks" state 3.5 seconds after a successful
  // send. Keep state local — no need to round-trip via localStorage
  // beyond the timestamp (used by potential future cooldowns).
  useEffect(() => {
    if (!justSent) return;
    const t = setTimeout(() => {
      setJustSent(false);
      setOpen(false);
    }, 3500);
    return () => clearTimeout(t);
  }, [justSent]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "founder_modal",
          payload: {
            message: trimmed,
            source_url:
              typeof window !== "undefined" ? window.location.href : null,
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      try {
        window.localStorage.setItem(STORAGE_KEY_LAST_SEND, new Date().toISOString());
      } catch {
        /* swallow */
      }
      setMessage("");
      setJustSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* The chip itself — always rendered in the footer slot the
          parent provides. Doesn't follow the user around the page
          like a chat widget; reads as "I know where to find this
          when I have something to say." */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] transition px-3 h-8 text-[12.5px] font-medium text-ink"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <MessageCircle size={13} strokeWidth={2.2} className="text-brand" />
        <span>Talk to Nabil</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback to the founder"
          className="fixed inset-0 z-[60] px-4 pb-6 pt-10 flex items-end md:items-center justify-center"
        >
          {/* Backdrop — calm, dismisses on click. */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-ink/30 backdrop-blur-[2px]"
            style={{ zIndex: -1 }}
          />
          <div
            className="w-full max-w-[480px] rounded-2xl border border-hairline bg-surface shadow-lift p-5 md:p-6 animate-fadeUp"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/25 px-2 h-5 text-[10.5px] font-medium text-brand uppercase tracking-[0.08em]">
                  Founder
                </div>
                <h3 className="mt-2 font-display text-[18px] md:text-[20px] font-semibold tracking-[-0.01em] text-ink leading-snug">
                  What confused you, surprised you, or should we improve?
                </h3>
                <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">
                  Goes straight to Nabil — one of the people building Frugavo.
                  Replies usually within a day.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition"
                aria-label="Close"
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>

            {justSent ? (
              <div className="mt-5 rounded-xl bg-brand/10 border border-brand/20 px-4 py-4 flex items-start gap-3">
                <Check size={16} strokeWidth={2.4} className="text-brand mt-0.5" />
                <div>
                  <div className="text-[14px] font-medium text-ink">
                    Got it. Thanks.
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-ink-body leading-relaxed">
                    Nabil will read this personally. If a reply makes sense,
                    you&apos;ll hear back at the email on your account.
                  </div>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write whatever's on your mind — confused, missing feature, surprising insight, anything."
                  rows={5}
                  className="mt-5 w-full rounded-xl border border-hairline bg-canvas/40 px-3.5 py-3 text-[14px] text-ink leading-relaxed placeholder:text-ink-muted/80 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40 transition resize-none"
                  maxLength={8000}
                />
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                  <span>
                    Includes the page you&apos;re on for context — never your
                    transactions.
                  </span>
                  <span className="tabular-nums">{message.length} / 8000</span>
                </div>

                {error ? (
                  <p className="mt-3 text-[12.5px] text-danger">{error}</p>
                ) : null}

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={sending}
                    className="inline-flex h-10 items-center justify-center rounded-full text-[13px] font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition px-4 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={sending || message.trim().length === 0}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-ink text-canvas text-[13px] font-medium hover:bg-ink/85 transition px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={13} strokeWidth={2.2} />
                    {sending ? "Sending…" : "Send to Nabil"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
