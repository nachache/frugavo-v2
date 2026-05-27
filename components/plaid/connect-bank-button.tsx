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
  | "idle"          // initial; link token may still be loading in
                    // the background but we present the button as
                    // ready-to-click so it doesn't look "loading"
                    // before the user has done anything
  | "ready"         // token loaded, no click pending
  | "queued"        // user clicked while token wasn't ready yet —
                    // we auto-open as soon as the token lands
  | "connecting"    // Plaid Link modal is opening / open
  | "exchanging"    // Plaid succeeded, we're swapping public_token
                    // for an access_token server-side
  | "error";

const OAUTH_TOKEN_KEY = "frugavo:plaid:link_token";

export function ConnectBankButton() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  // Default to "idle" rather than "loading". The link-token fetch
  // happens in the background; meanwhile the button shows the active
  // CTA. Showing a spinner on initial paint was the old "Bug 2" —
  // it made the page look like it was already working before the
  // user had clicked anything.
  const [status, setStatus] = useState<Status>("idle");
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
          // Promote idle → ready, BUT preserve "queued" if the user
          // clicked while we were fetching. The auto-open effect
          // below will pick it up.
          setStatus((prev) => (prev === "queued" ? "queued" : "ready"));
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
        // Bank is connected. Clear the cached OAuth link_token; a
        // future re-connect should get a fresh one.
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(OAUTH_TOKEN_KEY);
        }
        // Route to /app/scanning so the user watches subscriptions
        // stream in via the progress arc + reveal list. The scanning
        // page kicks runScanForUser server-side inside its render; the
        // page only renders once the scan finishes (10-30s) and SSE
        // then replays the engine events from Redis Stream — phase
        // transitions, row events, and complete. The new ProgressArc
        // animates honestly off those real SSE phases (no timer).
        //
        // The earlier attempt to kick the scan async from
        // /api/plaid/exchange was abandoned because Netlify
        // terminates the lambda after response, killing the in-flight
        // scan promise mid-Plaid-sync. Synchronous server-render is
        // the reliable shape on this platform until we add a real
        // job queue.
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

  // Auto-open for the queued case: user clicked while we were still
  // fetching the link token. The moment the token + plaidLink are
  // ready, fire open() so the click feels instant despite the
  // background fetch.
  useEffect(() => {
    if (status === "queued" && ready && linkToken) {
      setStatus("connecting");
      open();
    }
  }, [status, ready, linkToken, open]);

  // Disabled only while Plaid Link is actively opening or we're
  // exchanging the token. "idle" and "queued" remain clickable —
  // the queued state shows a subtle spinner so the user knows their
  // click registered, but the button isn't visually broken.
  //
  // We intentionally do NOT disable during link-token fetch, so the
  // initial render looks ready-to-click (Bug 2 was the button
  // landing in a loading state before the user did anything).
  const disabled =
    status === "connecting" || status === "exchanging" || status === "error";

  // Static labels. The previous rotating "Scanning recurring
  // merchants…" copy during exchange was Bug 1 — it duplicated the
  // cinematic progress the /app/scanning page already runs. Keep the
  // button visually quiet between Plaid modal close and the
  // navigation to /app/scanning.
  const label =
    status === "connecting"
      ? "Opening secure bank login…"
      : status === "exchanging"
        ? "Connecting your bank…"
        : status === "queued"
          ? "Preparing your scan…"
          : "Scan my subscriptions";

  return (
    <div className="flex flex-col items-start">
      {/* Eyebrow copy — sets expectations BEFORE the click. */}
      <p className="text-[12.5px] md:text-[13px] text-ink-muted mb-3">
        Free scan. No credit card required.
      </p>

      <button
        onClick={() => {
          // If the link token + plaidLink hooks are both ready, open
          // immediately. Otherwise queue — the useEffect above will
          // auto-open as soon as both become ready.
          if (ready && linkToken && status !== "queued") {
            setStatus("connecting");
            open();
          } else {
            setStatus("queued");
          }
        }}
        disabled={disabled}
        className="group inline-flex h-13 sm:h-14 items-center justify-center gap-2.5 rounded-2xl bg-ink px-7 sm:px-8 text-[15px] sm:text-[16px] font-semibold text-canvas shadow-[0_8px_24px_-8px_rgba(10,10,10,0.4)] hover:bg-ink/90 hover:shadow-[0_12px_28px_-8px_rgba(10,10,10,0.5)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_4px_12px_-4px_rgba(10,10,10,0.4)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        style={{ height: "3.25rem" }}
      >
        {(status === "queued" || status === "exchanging" || status === "connecting") && (
          <Loader2 size={16} className="animate-spin -ml-0.5" />
        )}
        <span>{label}</span>
        {(status === "idle" || status === "ready") && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="-mr-0.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        )}
      </button>

      {/* Sub-copy: anchors expected duration so the user doesn't bail. */}
      <p className="mt-3 text-[12.5px] md:text-[13px] text-ink-muted">
        Takes about 30 seconds.
      </p>

      {errorMessage && (
        <p
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-danger"
          role="alert"
        >
          <ShieldCheck size={13} />
          {errorMessage}
        </p>
      )}
    </div>
  );
}
