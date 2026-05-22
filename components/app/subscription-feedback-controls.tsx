"use client";

// SubscriptionFeedbackControls — the override controls shown on the
// subscription detail page.
//
// Five labels map directly to the override_type enum the feedback
// endpoint accepts:
//
//   confirmed         — "Confirm subscription"
//   not_subscription  — "Not a subscription" (recurring but not a sub)
//   not_recurring     — "This isn't recurring"
//   wrong_amount      — inline editor → POST { amount_cents }
//   wrong_cadence     — inline editor → POST { frequency }
//   cancelled         — "I cancelled this"
//
// After a successful POST the page is refreshed (router.refresh) so
// stats, badges, and the dashboard recompute from the new state.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type OverrideType =
  | "confirmed"
  | "not_subscription"
  | "not_recurring"
  | "wrong_amount"
  | "wrong_cadence"
  | "cancelled";

type Props = {
  subscriptionId: string;
  merchantName: string;
  currentAmountCents: number;
  currentFrequency: string;
};

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "semi_monthly", label: "Twice a month" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

export function SubscriptionFeedbackControls({
  subscriptionId,
  merchantName,
  currentAmountCents,
  currentFrequency,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openEditor, setOpenEditor] = useState<
    null | "amount" | "cadence"
  >(null);
  const [amountInput, setAmountInput] = useState(
    (currentAmountCents / 100).toFixed(2)
  );
  const [cadenceInput, setCadenceInput] = useState(currentFrequency);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  async function submit(
    type: OverrideType,
    value?: Record<string, unknown>
  ) {
    setErrored(false);
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription_id: subscriptionId,
            override_type: type,
            override_value: value ?? {},
          }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) {
          setErrored(true);
          setFeedback(j.error ?? "Something went wrong.");
          return;
        }
        const msg = messageFor(type, merchantName);
        setFeedback(msg);
        setOpenEditor(null);
        router.refresh();
      } catch (e) {
        setErrored(true);
        setFeedback(e instanceof Error ? e.message : "Network error.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6 animate-fadeUp">
      <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
        Your feedback
      </div>
      <div className="mt-1 text-[13px] md:text-[14px] text-ink-body">
        Tell us how this is wrong — we&apos;ll use it to improve detection
        across the whole network.
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn variant="primary" disabled={pending} onClick={() => submit("confirmed")}>
          Confirm subscription
        </Btn>
        <Btn variant="secondary" disabled={pending} onClick={() => setOpenEditor("amount")}>
          Wrong amount
        </Btn>
        <Btn variant="secondary" disabled={pending} onClick={() => setOpenEditor("cadence")}>
          Wrong cadence
        </Btn>
        <Btn variant="secondary" disabled={pending} onClick={() => submit("cancelled")}>
          I cancelled this
        </Btn>
        <Btn variant="ghost" disabled={pending} onClick={() => submit("not_subscription")}>
          Not a subscription
        </Btn>
        <Btn variant="ghost" disabled={pending} onClick={() => submit("not_recurring")}>
          Not recurring
        </Btn>
      </div>

      {openEditor === "amount" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-[13px] text-ink-body">
            Real amount per cycle:
          </label>
          <div className="inline-flex items-center rounded-full border border-hairline bg-canvas/40 pl-3 pr-1 h-10">
            <span className="text-[14px] text-ink-muted">$</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-24 bg-transparent outline-none text-[14px] text-ink tabular-nums px-2"
            />
            <button
              type="button"
              className="ml-1 h-8 px-3 rounded-full bg-ink text-canvas text-[12.5px] font-medium hover:bg-ink/85 transition disabled:opacity-50"
              disabled={pending}
              onClick={() => {
                const n = Number(amountInput);
                if (!Number.isFinite(n) || n <= 0) {
                  setErrored(true);
                  setFeedback("Please enter a positive amount.");
                  return;
                }
                submit("wrong_amount", {
                  amount_cents: Math.round(n * 100),
                });
              }}
            >
              Save
            </button>
          </div>
          <button
            type="button"
            className="text-[12.5px] text-ink-muted hover:text-ink transition"
            onClick={() => setOpenEditor(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {openEditor === "cadence" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-[13px] text-ink-body">
            Real cadence:
          </label>
          <select
            value={cadenceInput}
            onChange={(e) => setCadenceInput(e.target.value)}
            className="rounded-full border border-hairline bg-canvas/40 h-10 px-4 text-[14px] text-ink outline-none"
          >
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="h-10 px-4 rounded-full bg-ink text-canvas text-[12.5px] font-medium hover:bg-ink/85 transition disabled:opacity-50"
            disabled={pending}
            onClick={() =>
              submit("wrong_cadence", { frequency: cadenceInput })
            }
          >
            Save
          </button>
          <button
            type="button"
            className="text-[12.5px] text-ink-muted hover:text-ink transition"
            onClick={() => setOpenEditor(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={[
            "mt-4 rounded-xl px-3 py-2 text-[13px]",
            errored
              ? "bg-danger/10 text-danger border border-danger/30"
              : "bg-brand/10 text-brand border border-brand/30",
          ].join(" ")}
        >
          {feedback}
        </div>
      )}
    </div>
  );
}

function messageFor(type: OverrideType, name: string): string {
  switch (type) {
    case "confirmed":
      return `Got it — confirmed ${name} as a subscription.`;
    case "not_subscription":
      return `Noted — ${name} is recurring but not a subscription.`;
    case "not_recurring":
      return `Removed ${name} from your subscriptions.`;
    case "wrong_amount":
      return `Saved the corrected amount for ${name}.`;
    case "wrong_cadence":
      return `Saved the corrected cadence for ${name}.`;
    case "cancelled":
      return `Marked ${name} as cancelled. We'll watch for a refund.`;
  }
}

function Btn({
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
        "inline-flex items-center h-9 px-3 md:px-4 rounded-full text-[12.5px] md:text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
        cls,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
