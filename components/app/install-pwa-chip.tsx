"use client";

import { useEffect, useState } from "react";
import { Smartphone, Share2, X } from "lucide-react";

// InstallPwaChip — quiet, dismissible affordance to install Frugavo
// to the user's home screen.
//
// Why this is a "chip" and not a banner:
//   The brand voice is calm financial intelligence. A modal or
//   bottom sheet competes with the dashboard's first impression.
//   A small chip in the corner reads as an offer, not an ask.
//
// Two platforms, two flows:
//
//   1. Android Chrome (and Edge / Samsung Internet on Android)
//      Captures the standard `beforeinstallprompt` event, hides
//      the default mini-info bar, and triggers the prompt when
//      the user taps "Install."
//
//   2. iOS Safari
//      Does NOT support beforeinstallprompt. Install is a manual
//      flow: Share menu → "Add to Home Screen." We detect iOS
//      Safari (excluding in-app browsers) and show a one-time
//      mini sheet with the literal Share icon + the two-step
//      instruction. Tapping "Got it" dismisses it forever.
//
// Gating rules:
//   • Hide entirely when already running standalone — handled by
//     CSS via the .browser-only class.
//   • Hide if user has previously dismissed (localStorage flag).
//   • Hide if the meaningful-first-session signal isn't set
//     (`alreadyEngaged` prop). The chip should never appear during
//     the user's first uncertain seconds on the dashboard.
//
// The CSS .browser-only class (in globals.css) hides any element
// tagged with it when display-mode is standalone, so we don't need
// a JS check for that case.

const DISMISS_KEY = "frugavo:install-chip:dismissed-at";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPwaChip({
  alreadyEngaged,
}: {
  // Mirror of app_users.dashboard_first_session_at !== null. Chip
  // only renders when the user has had a meaningful session — never
  // during the calm "first magic moment" reveal.
  alreadyEngaged: boolean;
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"android" | "ios" | "other" | null>(
    null
  );
  const [dismissed, setDismissed] = useState(true); // optimistic-hide until we know
  const [iosTipOpen, setIosTipOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Persisted dismiss check.
    try {
      const previous = window.localStorage.getItem(DISMISS_KEY);
      setDismissed(!!previous);
    } catch {
      setDismissed(false);
    }

    // Platform detection. iOS Safari (not Chrome on iOS, not in-app
    // webviews) is the only iOS path that supports Add-to-Home-Screen.
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);
    // CRITERIA-IS-SAFARI: iOS but not Chrome/Edge/FxiOS — those
    // don't expose the Share → Add-to-Home-Screen path consistently.
    const isInAppOrAltBrowser = /CriOS|FxiOS|EdgiOS|GSA/i.test(ua);
    if (isIos && !isInAppOrAltBrowser) setPlatform("ios");
    else if (isAndroid) setPlatform("android");
    else setPlatform("other");

    // beforeinstallprompt — Android Chrome.
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // When the install actually completes (Android), clear our state.
    const onInstalled = () => {
      setDeferredPrompt(null);
      try {
        window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
      } catch {
        /* noop */
      }
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    setIosTipOpen(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      /* noop */
    }
  }

  async function handleInstallTap() {
    if (platform === "ios") {
      setIosTipOpen(true);
      return;
    }
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (choice.outcome === "accepted") {
          // appinstalled will fire — handler above stamps dismiss.
        } else {
          dismiss();
        }
      } catch {
        dismiss();
      }
    }
  }

  // Gating — don't render until we actually want to be visible.
  if (!alreadyEngaged) return null;
  if (dismissed) return null;
  // Android: nothing to show until the browser fires beforeinstallprompt.
  if (platform === "android" && !deferredPrompt) return null;
  // 'other' platforms (desktop Linux Firefox, etc.) — skip silently.
  if (platform === "other" || platform === null) return null;

  // Mark with .browser-only so the chip vanishes once the user is
  // running inside the installed PWA.
  return (
    <div className="browser-only">
      <button
        type="button"
        onClick={handleInstallTap}
        className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] transition px-3 h-8 text-[12.5px] font-medium text-ink animate-fadeUp"
        aria-label="Install Frugavo to your home screen"
      >
        <Smartphone size={13} strokeWidth={2.2} aria-hidden="true" />
        <span>Install Frugavo</span>
      </button>

      {iosTipOpen ? (
        <div
          role="dialog"
          aria-label="Install Frugavo on iOS"
          className="fixed inset-x-0 bottom-0 z-50 px-4 pb-6 pt-3"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
          }}
        >
          {/* Soft backdrop that doesn't block dashboard scroll —
              tapping outside dismisses. */}
          <div
            aria-hidden="true"
            onClick={dismiss}
            className="fixed inset-0 bg-ink/30 backdrop-blur-[2px]"
            style={{ zIndex: -1 }}
          />
          <div className="mx-auto max-w-[420px] rounded-2xl border border-hairline bg-surface shadow-lift p-5 animate-fadeUp">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[14px] font-semibold text-ink leading-snug">
                Add Frugavo to your home screen
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition"
                aria-label="Dismiss"
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-[13.5px] text-ink-body leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink/[0.05] text-[11px] font-semibold text-ink shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Tap the{" "}
                  <Share2
                    size={13}
                    strokeWidth={2.2}
                    className="inline align-text-bottom"
                    aria-hidden="true"
                  />{" "}
                  Share button at the bottom of Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink/[0.05] text-[11px] font-semibold text-ink shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Scroll down and pick{" "}
                  <span className="font-medium text-ink">
                    Add to Home Screen
                  </span>
                  .
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="mt-5 inline-flex h-10 items-center justify-center w-full rounded-full bg-ink text-canvas text-[13.5px] font-medium hover:bg-ink/85 transition"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
