"use client";

import { useState } from "react";

// Small button rendered on each row of the admin billing customers
// table. POSTs to /api/admin/billing/replay with the clerk_user_id;
// the endpoint re-runs the projector for that customer.

export function AdminBillingReplayButton({
  clerkUserId,
}: {
  clerkUserId: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">(
    "idle"
  );

  async function replay() {
    setState("loading");
    try {
      const res = await fetch("/api/admin/billing/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerk_user_id: clerkUserId }),
      });
      setState(res.ok ? "ok" : "err");
      if (res.ok) {
        // Soft refresh so the row reflects post-replay state.
        setTimeout(() => window.location.reload(), 600);
      }
    } catch {
      setState("err");
    }
  }

  const label =
    state === "loading"
      ? "Replaying…"
      : state === "ok"
        ? "Replayed"
        : state === "err"
          ? "Failed"
          : "Replay";

  return (
    <button
      type="button"
      onClick={replay}
      disabled={state === "loading"}
      className={[
        "inline-flex h-7 items-center rounded-full border px-2.5 text-[11.5px] font-medium transition",
        state === "ok"
          ? "border-brand/30 bg-brand/10 text-brand"
          : state === "err"
            ? "border-danger/30 bg-danger/10 text-danger"
            : "border-hairline text-ink hover:bg-ink/[0.04]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
