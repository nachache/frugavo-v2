"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Auto-redirect client component for /app/billing/start.
//
// On mount: POSTs /api/billing/checkout and window.locations to the
// returned Stripe URL. The user sees a soft "Opening secure
// checkout…" state for ~500ms before Stripe loads.
//
// Error handling: if checkout creation fails (price not configured,
// Stripe API blip, etc.), we render an error state with a retry
// button + a back-to-dashboard escape hatch. We never leave the user
// stranded.

type Status = "starting" | "redirecting" | "error";

export function StartProtectionAutoRedirect() {
  const [status, setStatus] = useState<Status>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price_slug: "peace_of_mind_monthly" }),
        });
        if (cancelled) return;
        const data = (await res.json()) as {
          url?: string;
          error?: string;
          detail?: string;
        };
        if (!res.ok || !data.url) {
          setStatus("error");
          setErrorMessage(
            data.detail ??
              data.error ??
              "Couldn't open Stripe Checkout. Please try again."
          );
          return;
        }
        setStatus("redirecting");
        window.location.href = data.url;
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(
          e instanceof Error
            ? e.message
            : "Network issue. Please check your connection and try again."
        );
      }
    }
    start();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-danger/30 bg-white p-6 text-center">
        <h2 className="font-display text-[18px] font-bold text-ink">
          Couldn&apos;t open checkout
        </h2>
        <p className="mt-2 text-[14px] text-ink-body leading-relaxed">
          {errorMessage}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setStatus("starting");
              setErrorMessage(null);
              // re-trigger by remount via location reload — simplest
              window.location.reload();
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-canvas hover:bg-ink/85 transition"
          >
            Try again
          </button>
          <Link
            href="/app"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-medium text-ink-body hover:text-ink transition"
          >
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-3 text-ink-body"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 size={28} strokeWidth={2} className="text-brand animate-spin" aria-hidden />
      <span className="text-[13px]">
        {status === "redirecting" ? "Redirecting to Stripe…" : "Preparing checkout…"}
      </span>
    </div>
  );
}
