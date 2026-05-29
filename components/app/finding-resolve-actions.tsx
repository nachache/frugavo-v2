"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { Finding } from "@/lib/selectors/findings";

// FindingResolveActions — bottom of /app/noticed/[id]. Two
// resolution buttons per spec: "Look into it" / "Looks fine".
//
// Both write to the existing /api/feedback path so the dashboard
// state reflects the user's resolution immediately. We do NOT
// introduce a new schema:
//
//   • "Look into it" → POST /api/feedback with override_type:
//     "not_recurring" on the first subscription_id when one is
//     known. This is a soft "tell me more / I want to act" signal;
//     it surfaces the underlying sub in the Worth-a-look list.
//     TODO(findings-feedback): the right long-term mapping is a new
//       feedback_finding_resolve table so resolution lives at the
//       finding level, not the sub level. Out of scope here.
//
//   • "Looks fine" → POST /api/feedback with override_type:
//     "confirmed" on subscription_ids when known. Tells the engine
//     the user has reviewed this and is not concerned.
//
// On success we router.refresh() and bounce back to /app/noticed
// so the resolved finding is gone from the list.

type Props = {
  finding: Pick<Finding, "id" | "kind">;
  subscriptionIds: string[];
};

export function FindingResolveActions({ finding, subscriptionIds }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<null | "look" | "fine">(null);
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();
  void finding;

  async function submit(
    action: "look" | "fine",
    overrideType: "not_recurring" | "confirmed"
  ) {
    if (submitting) return;
    setSubmitting(action);
    try {
      // Best-effort writes — one per subscription id. We don't await
      // in series because each is independent and we want the
      // batch done quickly.
      if (subscriptionIds.length > 0) {
        await Promise.all(
          subscriptionIds.map((sid) =>
            fetch("/api/feedback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscription_id: sid,
                override_type: overrideType,
              }),
            }).catch(() => null)
          )
        );
      }
      setDone(true);
      startTransition(() => {
        router.refresh();
        // Brief beat so the user sees the success state, then bounce.
        setTimeout(() => router.push("/app/noticed"), 700);
      });
    } catch {
      setSubmitting(null);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-2.5 text-[13.5px] text-emerald-900">
        <Check size={14} strokeWidth={2.4} />
        Thanks — saved.
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        type="button"
        disabled={submitting !== null}
        onClick={() => submit("look", "not_recurring")}
        className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[13.5px] font-medium text-white disabled:opacity-60"
        style={{ background: "#0F6E56" }}
      >
        Look into it
      </button>
      <button
        type="button"
        disabled={submitting !== null}
        onClick={() => submit("fine", "confirmed")}
        className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[13.5px] font-medium text-ink border border-hairline bg-white hover:bg-canvas/40 transition disabled:opacity-60"
      >
        <X size={13} strokeWidth={2.2} className="mr-1.5 text-ink-muted" />
        Looks fine
      </button>
    </div>
  );
}
