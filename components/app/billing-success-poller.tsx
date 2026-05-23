"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Client-side poller for the post-payment success page.
//
// Flow (typical):
//   Time 0     — Stripe redirects user here
//   ~0-2s      — checkout.session.completed + customer.subscription.created
//                webhooks fire; our projector lands the entitlement row
//   ~2-5s      — poller picks up entitlement_state='trialing'; reveal
//
// Worst case (webhook delay, projection retry):
//   5-20s      — "still finalising" message keeps things calm
//   >30s       — "taking longer than expected", offer manual nudge
//
// Copy framing per build doc: "protection is now active", never
// "subscribed" or "purchased". The user is being protected, not
// buying software.

type CheckResponse = {
  entitlement_state:
    | "none"
    | "trialing"
    | "active"
    | "grace_period"
    | "cancelled_active"
    | "past_due"
    | "expired";
  session_status: "open" | "complete" | "expired" | null;
  payment_status: "paid" | "unpaid" | "no_payment_required" | null;
};

const POLL_INTERVAL_MS = 800;
const SLOW_THRESHOLD_MS = 5_000;
const TIMEOUT_THRESHOLD_MS = 30_000;

const ACCESS_STATES = new Set([
  "trialing",
  "active",
  "grace_period",
  "cancelled_active",
]);

export function BillingSuccessPoller({ sessionId }: { sessionId: string }) {
  const [phase, setPhase] = useState<"setup" | "slow" | "revealed" | "timeout">(
    "setup"
  );
  const [state, setState] = useState<CheckResponse | null>(null);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    let alive = true;

    async function tick() {
      if (!alive) return;
      try {
        const res = await fetch(
          `/api/billing/check?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          // Soft failure — keep polling
          scheduleNext();
          return;
        }
        const data = (await res.json()) as CheckResponse;
        if (!alive) return;
        setState(data);

        if (ACCESS_STATES.has(data.entitlement_state)) {
          setPhase("revealed");
          return;
        }

        const elapsed = Date.now() - startedAt.current;
        if (elapsed > TIMEOUT_THRESHOLD_MS) {
          setPhase("timeout");
          return;
        }
        if (elapsed > SLOW_THRESHOLD_MS) {
          setPhase("slow");
        }
        scheduleNext();
      } catch {
        scheduleNext();
      }
    }

    function scheduleNext() {
      if (!alive) return;
      window.setTimeout(tick, POLL_INTERVAL_MS);
    }

    tick();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  if (phase === "revealed") {
    return <RevealedState state={state} />;
  }
  if (phase === "timeout") {
    return <TimeoutState />;
  }
  return <SettingUpState slow={phase === "slow"} />;
}

function SettingUpState({ slow }: { slow: boolean }) {
  return (
    <div className="text-center animate-fadeUp">
      <div className="mx-auto h-12 w-12 rounded-full border-2 border-hairline border-t-brand animate-spin" />
      <h1 className="mt-6 font-display text-[28px] md:text-[34px] font-bold tracking-[-0.03em] leading-[1.1] text-ink">
        {slow ? "Still finalising your protection…" : "Setting up your protection…"}
      </h1>
      <p className="mt-3 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
        {slow
          ? "Hang tight — this usually takes a few seconds, sometimes a little longer."
          : "We're activating monitoring on your account."}
      </p>
    </div>
  );
}

function RevealedState({ state }: { state: CheckResponse | null }) {
  const isTrialing = state?.entitlement_state === "trialing";
  return (
    <div className="text-center animate-fadeUp">
      <div className="mx-auto h-14 w-14 rounded-full bg-brand/10 flex items-center justify-center">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-brand"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-[34px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        You&apos;re protected.
      </h1>
      <p className="mt-3 text-[15px] md:text-[16px] leading-relaxed text-ink-body">
        {isTrialing
          ? "Frugavo is now watching your accounts. You'll get an alert the first time we catch something — a new charge, a price hike, a trial about to convert."
          : "Frugavo is now watching your accounts."}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/app"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-medium text-white hover:bg-brand-hover transition"
        >
          Open dashboard
        </Link>
        <Link
          href="/app/protection"
          className="inline-flex h-12 items-center gap-2 rounded-full border border-hairline bg-surface px-6 text-[15px] font-medium text-ink hover:bg-ink/[0.04] transition"
        >
          See what we&apos;re watching
        </Link>
      </div>
    </div>
  );
}

function TimeoutState() {
  return (
    <div className="text-center animate-fadeUp">
      <h1 className="font-display text-[28px] md:text-[34px] font-bold tracking-[-0.03em] leading-[1.1] text-ink">
        This is taking longer than usual.
      </h1>
      <p className="mt-3 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
        Your payment went through, but our system hasn&apos;t finished
        activating monitoring yet. Refresh in a minute or open your dashboard —
        if it&apos;s still not showing as protected, we&apos;ll fix it from
        our side.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/app"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-medium text-white hover:bg-brand-hover transition"
        >
          Open dashboard
        </Link>
      </div>
    </div>
  );
}
