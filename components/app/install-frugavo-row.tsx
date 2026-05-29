"use client";

import { useEffect, useState } from "react";
import { Smartphone, Share2, X, Check } from "lucide-react";

// InstallFrugavoRow — persistent Settings entry to install the PWA.
//
// The dashboard chip (InstallPwaChip) is for first-time discovery
// — once a user dismisses it, the dashboard surface goes quiet
// forever. This row is the canonical "I want to install now" home
// in Settings, so the affordance is always reachable.
//
// Three states the row can be in:
//
//   1. Already installed → renders "Frugavo is installed" with a
//      check icon. No action available.
//   2. Android Chrome with a captured beforeinstallprompt → renders
//      a primary "Install" button that triggers the native prompt
//      when tapped.
//   3. iOS Safari (or any browser without a deferred prompt) →
//      renders a "How to install" disclosure that explains the
//      Share → Add to Home Screen flow.

type Platform = "ios" | "android" | "desktop" | "other";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallFrugavoRow() {
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [iosExpanded, setIosExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Standalone check — if matchMedia reports standalone OR the
    // legacy iOS `navigator.standalone` is true, we're already
    // running as an installed PWA.
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const iosStandalone =
      "standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    setInstalled((mq && mq.matches) || iosStandalone);

    // Platform detection.
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);
    const inAppBrowser = /CriOS|FxiOS|EdgiOS|GSA/i.test(ua);
    if (isIos && !inAppBrowser) setPlatform("ios");
    else if (isAndroid) setPlatform("android");
    else if (!isIos && !isAndroid) setPlatform("desktop");
    else setPlatform("other");

    // Capture the install prompt if Android Chrome offers one.
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function triggerAndroidPrompt() {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    } catch {
      /* swallow */
    }
  }

  // ─── installed ─────────────────────────────────────────────────
  if (installed) {
    return (
      <div className="flex items-start justify-between gap-4 py-1">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-ink">
            Frugavo is installed
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-muted leading-snug">
            You&apos;re using the installed app right now. Calm protection,
            home-screen launchable.
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 h-7 text-[12px] font-medium text-brand">
          <Check size={12} strokeWidth={2.6} />
          Installed
        </span>
      </div>
    );
  }

  // ─── Android Chrome with native prompt available ───────────────
  if (platform === "android" && deferredPrompt) {
    return (
      <div className="flex items-start justify-between gap-4 py-1 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-ink">
            Add Frugavo to your home screen
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-muted leading-snug">
            Launches in a single tap, runs without browser chrome, and is
            ready for offline-friendly future updates.
          </div>
        </div>
        <button
          type="button"
          onClick={triggerAndroidPrompt}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-ink text-canvas text-[13px] font-medium hover:bg-ink/85 transition px-4"
        >
          <Smartphone size={13} strokeWidth={2.2} />
          Install
        </button>
      </div>
    );
  }

  // ─── iOS Safari → expandable Share → Add to Home Screen guide ──
  if (platform === "ios") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setIosExpanded((v) => !v)}
          className="w-full flex items-start justify-between gap-4 py-1 text-left"
          aria-expanded={iosExpanded}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-ink">
              Add Frugavo to your home screen
            </div>
            <div className="mt-0.5 text-[12.5px] text-ink-muted leading-snug">
              Tap to see the two-step install on iOS Safari.
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 h-7 text-[12px] font-medium text-ink">
            <Smartphone size={12} strokeWidth={2.2} />
            {iosExpanded ? "Hide" : "Show how"}
          </span>
        </button>

        {iosExpanded ? (
          <div className="mt-3 rounded-xl border border-hairline/60 bg-canvas/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[13.5px] font-medium text-ink">
                Two-step install
              </div>
              <button
                type="button"
                onClick={() => setIosExpanded(false)}
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition"
                aria-label="Hide instructions"
              >
                <X size={12} strokeWidth={2.2} />
              </button>
            </div>
            <ol className="mt-3 space-y-2.5 text-[13px] text-ink-body leading-relaxed">
              <li className="flex items-start gap-2.5">
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
              <li className="flex items-start gap-2.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink/[0.05] text-[11px] font-semibold text-ink shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Scroll down and pick{" "}
                  <span className="font-medium text-ink">
                    Add to Home Screen
                  </span>
                  . Frugavo launches like a regular app from then on.
                </span>
              </li>
            </ol>
          </div>
        ) : null}
      </div>
    );
  }

  // ─── desktop / fallback ─────────────────────────────────────────
  if (platform === "desktop") {
    return (
      <div className="flex items-start justify-between gap-4 py-1 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-ink">
            Frugavo on your home screen
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-muted leading-snug">
            The full installable experience is on phones today. Open
            frugavo.com on iOS Safari or Android Chrome to add it to your
            home screen.
          </div>
        </div>
      </div>
    );
  }

  return null;
}
