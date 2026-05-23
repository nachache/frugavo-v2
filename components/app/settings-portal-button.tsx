"use client";

import { useState } from "react";

// Opens the Stripe Customer Portal. Used from the settings Billing
// panel for users who have an existing Stripe Customer (trialing,
// active, cancelled_active, grace_period).

export function OpenPortalButton({ label }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError("Couldn't open billing portal. Try again in a moment.");
      setLoading(false);
    } catch {
      setError("Couldn't open billing portal. Try again in a moment.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-surface px-5 text-[14px] font-medium text-ink hover:bg-ink/[0.04] transition disabled:opacity-70"
      >
        {loading ? "Opening…" : (label ?? "Manage billing")}
      </button>
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
