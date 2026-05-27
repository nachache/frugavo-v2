"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { AlertTriangle, Loader2 } from "lucide-react";

// Client-side action buttons for the Settings page. Disconnect lives
// inline next to each bank in the list. Delete-account is its own card
// with a typed-confirmation gate.

export function DisconnectBankButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    startSubmit(async () => {
      setError(null);
      const res = await fetch("/api/plaid/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });
      if (!res.ok) {
        setError("Could not disconnect. Try again.");
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-[13px] text-ink-muted hover:text-danger transition"
      >
        Disconnect
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={submit}
        disabled={submitting}
        className="inline-flex h-8 items-center gap-1 rounded-full bg-danger px-3 text-[12px] font-medium text-white disabled:opacity-50"
      >
        {submitting && <Loader2 size={11} className="animate-spin" />}
        Confirm disconnect
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-[12px] text-ink-muted hover:text-ink"
      >
        Cancel
      </button>
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </div>
  );
}

export function DeleteAccountCard() {
  const { signOut } = useClerk();
  const [phrase, setPhrase] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = () => {
    if (phrase !== "DELETE") {
      setError("Type DELETE to confirm.");
      return;
    }
    startSubmit(async () => {
      setError(null);
      let serverOk = false;
      try {
        const res = await fetch("/api/account/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: "DELETE" }),
        });
        serverOk = res.ok;
        if (!serverOk) {
          const text = await res.text().catch(() => "");
          // eslint-disable-next-line no-console
          console.error("[account/delete] non-ok response:", res.status, text);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[account/delete] network error:", e);
      }

      if (!serverOk) {
        setError(
          "Could not delete account data. Please email hello@frugavo.com."
        );
        return;
      }

      setDone(true);

      // v8 — Bug #3 fix.
      //
      // The previous version awaited signOut() before window.location.
      // replace(). In Clerk v5.7.5 with App Router, signOut() can hang
      // indefinitely AFTER /api/account/delete has already invalidated
      // the server-side session — the client call races against its
      // own deleted session and neither resolves nor rejects, so the
      // redirect never fires. The user sees "Redirecting…" forever.
      //
      // New sequence:
      //   1. Fire signOut() WITHOUT awaiting. If it resolves, great;
      //      if it hangs, we don't care — the hard navigation tears
      //      down the page anyway. The .catch swallows errors so an
      //      unhandled rejection doesn't leak into the console after
      //      the page is already navigating.
      //   2. Hard navigate to "/" (a PUBLIC route) via
      //      window.location.replace. replace() over href so the back
      //      button can't return to /app/settings as a logged-out
      //      user. The navigation happens immediately — the
      //      "Redirecting…" copy is briefly visible during the
      //      one-tick paint before the browser starts loading "/".
      //
      // No await, no useEffect, no router.push — the brief's exact
      // recipe: hard redirect to a public route, never rely on a
      // client-side router push into a guarded route after the
      // session is gone.
      void signOut().catch(() => {
        // best-effort — destination route doesn't depend on Clerk
        // session being clean; the next protected request would 401
        // and reconcile.
      });

      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    });
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-brand/30 bg-brand-light/40 p-5">
        <p className="text-[14px] text-emerald-950">
          Your Frugavo data has been removed. Redirecting…
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/[0.04] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-danger mt-0.5 shrink-0" />
        <div>
          <div className="text-[14px] font-semibold text-ink">
            Delete my Frugavo data
          </div>
          <p className="mt-1 text-[12.5px] text-ink-body leading-relaxed">
            Removes every subscription, scan, cancellation, and bank
            connection from our database. Plaid tokens are revoked, any
            active subscription is cancelled, and you&apos;ll be signed
            out. This cannot be undone.
          </p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value.toUpperCase())}
              placeholder="Type DELETE to confirm"
              className="h-9 rounded-full border border-hairline bg-white px-3 text-[13px] outline-none focus:border-danger w-full sm:w-[200px]"
            />
            <button
              onClick={submit}
              disabled={submitting || phrase !== "DELETE"}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-danger px-4 text-[13px] font-medium text-white hover:bg-danger/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Delete everything
            </button>
          </div>
          {error && (
            <p className="mt-2 text-[12.5px] text-danger">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
