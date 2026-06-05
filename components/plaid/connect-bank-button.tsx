"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Loader2, ShieldCheck } from "lucide-react";
import { track } from "@/lib/learning/track";

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
// Session-scoped flag so the post-signup auto-open fires AT MOST once
// per browser session. Without this, back-navigating to /app/connect
// (or any second mount of the hero button) would re-pop Plaid Link,
// which feels broken. Cleared automatically when the tab closes.
const AUTO_OPEN_FIRED_KEY = "frugavo:plaid:auto_opened";

export function ConnectBankButton({
  variant = "hero",
  compactLabel = "Add another account",
  autoOpen = false,
}: {
  // 'hero'    — first-connect /app/connect CTA. Big shadowed pill with
  //             "Free scan" eyebrow and "Takes about 30 seconds." subline.
  // 'compact' — inline secondary affordance for use INSIDE other UI
  //             (e.g. settings page after one bank is already connected).
  //             No eyebrow / subline; smaller height; uses compactLabel.
  variant?: "hero" | "compact";
  compactLabel?: string;
  // When true, auto-fires open() after a 1.5s grace window once the
  // Plaid Link is ready. Used on /app/connect right after sign-up so
  // cold ad traffic doesn't have to click through a second CTA after
  // the sign-up form. The grace window lets the user register the
  // trust copy ("read-only via Plaid") for one breath before the
  // modal pops; sessionStorage guarantees it only fires once per
  // tab so closing the modal doesn't re-trigger it on navigation
  // back. OAuth resume has its own auto-open path and is not
  // affected by this flag.
  autoOpen?: boolean;
} = {}) {
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

  // Captured at success-time so the button can render a
  // proof-of-connection label ("Chase ····4821 connected — preparing
  // your scan…") while we hand off to /app. Plaid Link Messaging
  // best practice: show the user the institution + masked account
  // immediately after onSuccess so they have visible evidence the
  // link worked, before any routing or skeletons.
  const [successInstitution, setSuccessInstitution] = useState<string | null>(null);
  const [successMask, setSuccessMask] = useState<string | null>(null);

  // Step 4 — when Link succeeds, exchange the public_token server-side.
  const onSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setStatus("exchanging");
      // Stash the institution name + first account mask for the
      // success label. We only show the first account's mask — most
      // users link one bank at a time and showing every mask gets
      // noisy. The dashboard later shows the full per-account list.
      const instName = metadata.institution?.name ?? null;
      const firstMask = metadata.accounts?.[0]?.mask ?? null;
      setSuccessInstitution(instName);
      setSuccessMask(firstMask);
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
        // v11 — route to /app, NOT /app/scanning. The dashboard route
        // is now state-aware (IngestionState machine: preparing /
        // syncing / analyzing / ready_with_results / ready_but_empty
        // / needs_reauth). PreparingScreen renders a real milestone
        // strip + skeleton dashboard while the webhook-driven scan
        // runs in the background. The user can close this tab and
        // ingestion continues; they'll get an email when ready.
        //
        // /app/scanning still exists for the live SSE reveal, but is
        // only reached via explicit Re-scan button — not as the
        // first-connect destination. That separation is what fixes
        // the "Subscriptions top-right loops back to scan" bug.
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

  // Post-signup auto-open (Option A from the funnel debug).
  //
  // When autoOpen=true (passed by the hero CTA on /app/connect right
  // after sign-up), wait 2.5s after Plaid Link is ready, then fire
  // open() automatically. The grace window lets the visitor read the
  // hero copy + trust line so the modal feels invited rather than
  // thrown at them.
  //
  // Delay bumped 1.5s → 2.5s on 2026-06-05 (Phase G follow-up). With
  // the beta-to-production graduation, more new visitors arrive cold
  // and need an extra beat to absorb that we're a paid product and
  // that connecting is read-only. sessionStorage prevents re-firing
  // on back-navigation or a second hero mount in the same tab.
  // OAuth resume has its own auto-open path above and is excluded
  // here.
  useEffect(() => {
    if (!autoOpen) return;
    if (isOAuthResume) return;
    if (status !== "ready") return;
    if (!ready || !linkToken) return;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(AUTO_OPEN_FIRED_KEY) === "1") return;

    const timer = window.setTimeout(() => {
      // Re-check the flag inside the timer in case a sibling button
      // mounted in the same render cycle already raced ahead and
      // opened the modal.
      if (window.sessionStorage.getItem(AUTO_OPEN_FIRED_KEY) === "1") return;
      window.sessionStorage.setItem(AUTO_OPEN_FIRED_KEY, "1");
      track("plaid_auto_opened", { surface: "connect_hero" });
      setStatus("connecting");
      open();
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [autoOpen, isOAuthResume, status, ready, linkToken, open]);

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

  // Static labels.
  //
  // Voice rule (Founder Access era): the CTA names the OUTCOME,
  // not the mechanism. "Analyze my recurring spending" mirrors the
  // first-ready email subject and the connect-page hero — one
  // continuous promise from landing to dashboard.
  //
  // In-flight labels still describe what's happening, but use
  // user-facing language ("preparing," "connecting") not engine
  // language ("scanning," "exchanging").
  // Plaid Link Messaging guideline: prefer "add" over "connect"/"link".
  // Word "instantly" used for the primary variant per Plaid research
  // (proven to lift uptake when button width allows).
  const idleLabel =
    variant === "compact" ? compactLabel : "Add your bank account instantly";
  // Once exchange starts, prefer a proof-of-connection label that
  // names the institution + the last 4 of the account number. Gives
  // the user immediate evidence the link worked, before they get
  // routed to /app. Falls back to a generic "Setting up your
  // analysis…" if Plaid didn't return institution/account metadata
  // (some sandbox flows omit it).
  const successProofLabel =
    successInstitution && successMask
      ? `${successInstitution} ····${successMask} connected — preparing your scan…`
      : successInstitution
        ? `${successInstitution} connected — preparing your scan…`
        : "Setting up your analysis…";
  const label =
    status === "connecting"
      ? "Opening secure bank login…"
      : status === "exchanging"
        ? successProofLabel
        : status === "queued"
          ? "Preparing your analysis…"
          : idleLabel;

  // Compact variant — used inside settings page next to an existing
  // banks list, where the heavy first-connect CTA would dominate.
  // Smaller pill, no eyebrow/sub copy, plus icon prefix that reads as
  // "add" rather than "scan".
  if (variant === "compact") {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <button
          onClick={() => {
            // Funnel signal — fires before Plaid Link opens so we
            // capture intent regardless of whether the user completes
            // the connect flow. Same event name in both the compact
            // and primary variants so the funnel aggregates cleanly.
            track("connect_clicked", { variant: "compact" });
            if (ready && linkToken && status !== "queued") {
              setStatus("connecting");
              open();
            } else {
              setStatus("queued");
            }
          }}
          disabled={disabled}
          className="group inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-canvas hover:bg-ink/85 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {(status === "queued" || status === "exchanging" || status === "connecting") ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
          <span>{label}</span>
        </button>
        {errorMessage && (
          <p
            className="inline-flex items-center gap-1.5 text-[12px] text-danger"
            role="alert"
          >
            <ShieldCheck size={12} />
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      {/* Eyebrow copy — sets expectations BEFORE the click. The
          "no card" line is the calmest legitimacy signal we have at
          this surface; "Free to start" sets the right expectation
          post beta-graduation. */}
      <p className="text-[12.5px] md:text-[13px] text-ink-muted mb-3">
        Free to start · No card required
      </p>

      <button
        onClick={() => {
          // Funnel signal — see compact variant note above.
          track("connect_clicked", { variant: "primary" });
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

      {/* Sub-copy: anchors duration so the user doesn't bail. Soft
          re-emphasis of analysis (not "scan") to keep the voice
          consistent with the button label. */}
      <p className="mt-3 text-[12.5px] md:text-[13px] text-ink-muted">
        Your first analysis is ready in about 60 seconds.
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
