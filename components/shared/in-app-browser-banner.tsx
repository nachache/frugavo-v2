"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

// In-app browser detection banner.
//
// Problem this exists to solve:
// Cold ad traffic from X, Instagram, Facebook, LinkedIn opens links
// inside the host app's WebView (UIWebView / WKWebView on iOS,
// android.webkit.WebView on Android) instead of Safari or Chrome.
// Google blocks "Sign in with Google" OAuth requests from WebViews
// (Error 403 disallowed_useragent). This silently destroys
// conversion on every paid social channel.
//
// Strategy:
//   1. Detect in-app browsers via two layers:
//        a. Specific app UA tokens (Twitter, Facebook, Instagram, etc.)
//        b. Generic heuristic: iOS UA with "Mobile" but no "Safari/"
//           suffix is almost certainly a WKWebView (real Safari
//           always includes "Safari/<version>"). Android UA with
//           "; wv)" token is a WebView. These catch X ads even
//           when the X app changes its UA string.
//   2. Show a slim amber banner at the top of every page warning
//      the visitor BEFORE they tap a sign-in button.
//   3. Offer a platform-specific deep link out:
//        • Android  → intent:// scheme launches Chrome with the
//                     current URL.
//        • iOS      → tap-to-copy URL + instructions to paste in
//                     Safari (Apple blocks public force-open schemes).
//   4. ALWAYS-ON. No sessionStorage persistence. The banner shows on
//      every page load for in-app browser visitors regardless of
//      prior dismissals — the user explicitly wants it that way
//      because the 403 risk recurs on every signup attempt.
//   5. ?force_banner=1 URL override forces the banner on for any
//      browser so the founder can verify the design from any device.

type InAppDetection = {
  detected: boolean;
  app: string | null;
  platform: "ios" | "android" | null;
};

function detectInAppBrowser(ua: string): InAppDetection {
  if (!ua) return { detected: false, app: null, platform: null };

  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const platform = isIOS ? "ios" : isAndroid ? "android" : null;

  // Order matters: more specific app names first so the banner
  // can name the host app accurately ("Open in browser from X"
  // reads more clearly than a generic "in-app browser").
  if (/FBAN|FBAV|FB_IAB/i.test(ua))
    return { detected: true, app: "Facebook", platform };
  if (/Instagram/i.test(ua))
    return { detected: true, app: "Instagram", platform };
  if (/TikTok|Bytedance/i.test(ua))
    return { detected: true, app: "TikTok", platform };
  if (/LinkedInApp/i.test(ua))
    return { detected: true, app: "LinkedIn", platform };
  if (/Twitter|TwitterAndroid|X-App/i.test(ua))
    return { detected: true, app: "X", platform };
  if (/MicroMessenger/i.test(ua))
    return { detected: true, app: "WeChat", platform };
  if (/Line\//i.test(ua))
    return { detected: true, app: "Line", platform };
  if (/Snapchat/i.test(ua))
    return { detected: true, app: "Snapchat", platform };
  if (/Pinterest/i.test(ua))
    return { detected: true, app: "Pinterest", platform };

  // ─── Generic heuristics (catch unknown in-app browsers) ────
  // iOS: real Safari ALWAYS includes "Safari/<version>" in its UA.
  // Any UA with "iPhone|iPad" + "Mobile" + AppleWebKit but missing
  // "Safari/" is almost certainly a WKWebView embedded in some
  // app. This catches X (if Twitter renames their UA), Reddit,
  // and most other social/messaging in-app browsers.
  if (isIOS && /Mobile/.test(ua) && !/Safari\//.test(ua)) {
    return { detected: true, app: "this app", platform: "ios" };
  }

  // Android: WebView UA includes the "; wv)" token before the
  // closing paren of the platform string. Real Chrome doesn't.
  if (isAndroid && /;\s*wv\)/i.test(ua)) {
    return { detected: true, app: "this app", platform: "android" };
  }

  return { detected: false, app: null, platform };
}

// Manual override — ?force_banner=1 forces the banner regardless of
// detection. Used for QA from desktop / iOS Safari where the banner
// would normally not show. Param survives navigation if preserved
// in links; otherwise it's a one-pageload visibility flip.
function isForcedOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(window.location.href).searchParams.get("force_banner") === "1";
  } catch {
    return false;
  }
}

export function InAppBrowserBanner() {
  const [detection, setDetection] = useState<InAppDetection | null>(null);
  // dismissed is React state only — not persisted to storage. Every
  // fresh page load re-shows the banner. See file header comment 4.
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent;
    const result = detectInAppBrowser(ua);
    // ?force_banner=1 override — synthesize a generic detection so
    // the banner renders even on desktop Safari for QA.
    if (!result.detected && isForcedOn()) {
      setDetection({
        detected: true,
        app: "QA mode",
        platform: /Android/i.test(ua) ? "android" : "ios",
      });
      return;
    }
    setDetection(result);
  }, []);

  if (!detection || !detection.detected || dismissed) return null;

  const openInBrowser = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;

    if (detection.platform === "android") {
      // intent:// scheme launches Chrome with the target URL. If
      // Chrome isn't installed, the system browser handles it.
      // Stripping the protocol because the intent format requires
      // the URL without scheme.
      const stripped = url.replace(/^https?:\/\//, "");
      const intentUrl = `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end;`;
      window.location.href = intentUrl;
      return;
    }

    // iOS fallback: copy the URL to the clipboard. Modern iOS
    // doesn't expose a reliable public scheme to force-open in
    // Safari, so the cleanest UX is "we put the link on your
    // clipboard, paste it into Safari." The banner copy below
    // updates to confirm the copy.
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 3500);
        })
        .catch(() => {
          /* fallback noop — user can long-press the URL bar */
        });
    }
  };

  // Dismiss only affects this render — no sessionStorage write, so
  // the next page load (or signin click → new page) shows it again.
  const dismiss = () => setDismissed(true);

  // Tone is amber not red — this is a "heads up" not an emergency.
  // Sits above everything (z-100) so it doesn't get buried under
  // the sticky nav. safe-area-top respects iOS notch padding.
  return (
    <div
      role="region"
      aria-label="In-app browser warning"
      className="fixed top-0 left-0 right-0 z-[100] bg-amber-50 border-b border-amber-200 safe-area-top"
    >
      <div className="container-page py-2.5 flex items-center gap-3">
        <p className="text-[12.5px] leading-snug text-amber-900 flex-1 min-w-0">
          <span className="hidden sm:inline">
            You&apos;re viewing this inside the {detection.app} app. Google
            sign-in only works in real browsers — open this page in{" "}
            {detection.platform === "ios" ? "Safari" : "Chrome"} to continue.
          </span>
          <span className="sm:hidden">
            Open in {detection.platform === "ios" ? "Safari" : "Chrome"} to
            sign in with Google.
          </span>
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={openInBrowser}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-amber-900 text-amber-50 text-[12px] font-semibold hover:bg-amber-950 transition"
          >
            {detection.platform === "android" ? (
              <>
                <ExternalLink size={11} strokeWidth={2.5} />
                Open in Chrome
              </>
            ) : copied ? (
              <>Link copied — paste in Safari</>
            ) : (
              <>Copy link for Safari</>
            )}
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-amber-900 hover:bg-amber-100 transition"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
