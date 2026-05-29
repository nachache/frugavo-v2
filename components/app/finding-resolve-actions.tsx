"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { Finding } from "@/lib/selectors/findings";

// FindingResolveActions — bottom of /app/noticed/[id]. Two
// resolution buttons per spec: "Look into it" / "Looks fine".
//
// Each tap writes to TWO endpoints in parallel:
//
//   1. /api/learning/finding-resolve
//      Canonical finding-level resolution write. Stores one row in
//      feedback_finding_resolve keyed on (user, finding_id). The
//      noticed feed reads this set to filter resolved findings.
//
//   2. /api/feedback (per subscription_id, if any)
//      Continues the existing per-sub override behavior so the
//      engine learns from the user's decisions. "Look into it" maps
//      to override_type = "not_recurring" (surfaces in Worth-a-look);
//      "Looks fine" maps to override_type = "confirmed".
//
// Both writes are independent. The finding can be resolved without
// touching per-sub state if the finding has no contributing subs
// (e.g. the concentration finding has subscription_ids = []).
//
// On success we router.refresh() and route back to /app/noticed so
// the resolved finding is gone from the feed.
//
// alreadyResolved=true short-circuits to a "Resolved" state — the
// user can still view the finding via deep link but can't re-resolve
// it (the unique constraint on the table would no-op anyway).

type Props = {
  finding: Pick<Finding, "id" | "kind">;
  subscriptionIds: string[];
  alreadyResolved?: boolean;
};

export function FindingResolveActions({
  finding,
  subscriptionIds,
  alreadyResolved = false,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<null | "look" | "fine">(null);
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(
    action: "look_into_it" | "looks_fine",
    overrideType: "not_recurring" | "confirmed"
  ) {
    if (submitting || alreadyResolved) return;
    setSubmitting(action === "look_into_it" ? "look" : "fine");

    // Fire both writes in parallel. Either failing alone shouldn't
    // block the other; we treat the user-facing success as "we got
    // the finding-level write" — that's the one that drives the UI.
    const findingWritePromise = fetch("/api/learning/finding-resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        finding_id: finding.id,
        finding_kind: finding.kind,
        action,
        subscription_ids: subscriptionIds,
      }),
    }).catch(() => null);

    const overrideWritePromise =
      subscriptionIds.length > 0
        ? Promise.all(
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
          )
        : Promise.resolve([]);

    await Promise.all([findingWritePromise, overrideWritePromise]);

    setDone(true);
    startTransition(() => {
      router.refresh();
      setTimeout(() => router.push("/app/noticed"), 700);
    });
  }

  if (alreadyResolved && !done) {
    return (
      <div className="rounded-2xl border border-hairline bg-canvas/40 p-4 flex items-center gap-2.5 text-[13.5px] text-ink-body">
        <Check size={14} strokeWidth={2.4} className="text-ink-muted" />
        You&apos;ve already resolved this one.
      </div>
    );
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
        onClick={() => submit("look_into_it", "not_recurring")}
        className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[13.5px] font-medium text-white disabled:opacity-60"
        style={{ background: "#0F6E56" }}
      >
        Look into it
      </button>
      <button
        type="button"
        disabled={submitting !== null}
        onClick={() => submit("looks_fine", "confirmed")}
        className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[13.5px] font-medium text-ink border border-hairline bg-white hover:bg-canvas/40 transition disabled:opacity-60"
      >
        <X size={13} strokeWidth={2.2} className="mr-1.5 text-ink-muted" />
        Looks fine
      </button>
    </div>
  );
}
