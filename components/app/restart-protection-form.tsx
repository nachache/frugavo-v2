"use client";

import { useState } from "react";

// Single-button form that re-uses the existing checkout endpoint.
// Same backend as the original activation flow — we don't need a
// dedicated "restart" endpoint because Stripe Checkout will create
// a fresh subscription for the existing Stripe Customer.

export function RestartProtectionForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError("Couldn't open checkout — please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't open checkout — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-8 text-center">
      <button
        type="button"
        onClick={restart}
        disabled={loading}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-medium text-white hover:bg-brand-hover transition disabled:opacity-60 disabled:cursor-wait"
      >
        {loading ? "Opening checkout…" : "Restart Protection"}
      </button>
      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
