"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
//
// OAuth resume:
//   For OAuth banks (Chase, Capital One, most CA banks) Plaid redirects
//   the browser to APP_URL/app/connect?oauth_state_id=... after the user
//   authenticates with their bank. The Link component needs to be
//   re-initialized with the SAME link_token plus the receivedRedirectUri
//   so it can resume where it left off. We persist the token in
//   sessionStorage before redirect and rehydrate it on resume.

type Status =
  | "loading"
  | "ready"
  | "connecting"
  | "exchanging"
  | "error";

const OAUTH_TOKEN_KEY = "frugavo:plaid:link_token";

export function ConnectBankButton() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detect OAuth-resume entry (URL carries ?oauth_state_id=...). When
  // this is the case we MUST reuse the original link_token rather than
  // minting a fresh one — Plaid binds the OAuth state to the token that
  // was used to start the flow.
  const isOAuthResume = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URL(window.location.href).searchParams.has("oauth_state_id");
  }, []);

  // Step 1 — fetch a Link token when the component mounts. On OAuth
  // resume, rehydrate from sessionStorage instead.
  useEffect(() => {
    let cancelled = false;
    if (isOAuthResume && typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem(OAUTH_TOKEN_KEY);
      if (stored) {
        setLinkToken(stored);
        setStatus("ready");
        return;
      }
      // Fall through to fresh-token fetch if we somehow lost it — the
      // user will need to restart Link, but at least we don't deadlock.
    }
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.link_token) {
          setLinkToken(data.link_token);
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(OAUTH_TOKEN_KEY, data.link_token);
          }
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
  }, [isOAuthResume]);

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
        // Bank is connected. Clear the cached OAuth link_token; a future
        // re-connect should get a fresh one.
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(OAUTH_TOKEN_KEY);
        }
        // Route to /app/scanning so the user watches
        // subscriptions stream in via the progress arc + reveal list
        // instead of landing on a blank dashboard while the scan runs.
        // The scanning page auto-forwards to /app once the scan completes.
        router.push("/app/scanning");
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
    // When Plaid redirects back from the bank's OAuth page, pass the
    // current URL so Link can resume the flow. For first-time mounts
    // this is undefined and Link starts a fresh session.
    receivedRedirectUri:
      isOAuthResume && typeof window !== "undefined"
        ? window.location.href
        : undefined,
    onSuccess,
    onExit: (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.warn("[plaid] link exit with error:", err);
      }
      setStatus("ready");
    },
  });

  // On OAuth resume, auto-open Link as soon as it's ready — the user
  // is mid-flow and clicking a button again would feel broken.
  useEffect(() => {
    if (isOAuthResume && ready && linkToken && status === "ready") {
      setStatus("connecting");
      open();
    }
  }, [isOAuthResume, ready, linkToken, status, open]);

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
