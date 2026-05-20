"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Loader2, ShieldCheck } from "lucide-react";

// Connect-bank button.
//
// Flow:
//   1. On mount, POST to /api/plaid/link-token to get a short-lived token.
//   2. Initialize Plaid Link with that token via usePlaidLink.
//   3. When the user clicks the button, open the Link modal.
//   4. On Plaid success, POST { public_token, institution } to
//      /api/plaid/exchange. The server stores the permanent access_token
//      in Supabase.
//   5. Refresh the dashboard so /app/page.tsx routes them to the
//      subscriptions view instead of the connect step.

type Status =
  | "loading"
  | "ready"
  | "connecting"
  | "exchanging"
  | "error";

export function ConnectBankButton() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1 — fetch a Link token when the component mounts.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.link_token) {
          setLinkToken(data.link_token);
          setStatus("ready");
        } else {
          setStatus("error");
          setErrorMessage(data.error ?? "Could not initialize Plaid.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage("Network error fetching the link token.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 4 — when Link succeeds, exchange the public_token server-side.
  const onSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setStatus("exchanging");
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution: metadata.institution
              ? {
                  name: metadata.institution.name,
                  institution_id: metadata.institution.institution_id,
                }
              : null,
          }),
        });
        if (!res.ok) {
          setStatus("error");
          setErrorMessage("Could not save the connection.");
          return;
        }
        // Bank is connected. Dashboard at /app will now skip the connect
        // step on next render.
        router.push("/app");
        router.refresh();
      } catch {
        setStatus("error");
        setErrorMessage("Network error saving the connection.");
      }
    },
    [router]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
    onExit: (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.warn("[plaid] link exit with error:", err);
      }
      setStatus("ready");
    },
  });

  const disabled =
    status === "loading" ||
    status === "exchanging" ||
    status === "connecting" ||
    !ready ||
    !linkToken;

  const label =
    status === "loading"
      ? "Preparing the connection…"
      : status === "connecting"
      ? "Opening your bank…"
      : status === "exchanging"
      ? "Saving connection…"
      : "Connect my bank with Plaid";

  return (
    <div>
      <button
        onClick={() => {
          setStatus("connecting");
          open();
        }}
        disabled={disabled}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {(status === "loading" || status === "exchanging") && (
          <Loader2 size={16} className="animate-spin" />
        )}
        {label}
      </button>

      {errorMessage && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {errorMessage}
        </p>
      )}

      <p className="mt-4 inline-flex items-center gap-2 text-[12.5px] text-ink-muted">
        <ShieldCheck size={13} />
        Read-only access. We can&apos;t move money or change your account.
        Connection is sandboxed during pre-launch.
      </p>
    </div>
  );
}
