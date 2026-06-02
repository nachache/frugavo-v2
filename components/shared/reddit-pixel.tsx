"use client";

// Reddit Ads conversion pixel.
//
// Wraps the standard `rdt` base snippet in a Next/script so it loads
// with strategy="afterInteractive" — installs after hydration so it
// doesn't block the initial paint, but still in time to record the
// PageVisit event that Reddit's conversion attribution needs.
//
// Gated by ConsentGate in app/layout.tsx so the pixel never installs
// for visitors who declined cookies. Same treatment as the X pixel —
// it's an advertising pixel, not essential analytics.
//
// Pixel ID is centralised in NEXT_PUBLIC_REDDIT_PIXEL_ID env var so
// it can rotate without code changes. Falls back to the production
// pixel id committed below if the env var is missing — first-deploy
// safety net so we don't lose tracking if someone forgets to set the
// env var.
//
// Per-route conversion events (rdt('track', 'SignUp'), etc.) should
// be fired from the page where the conversion happens — for example
// a `<RedditConvert event="SignUp" />` could be added inside the
// post-signup welcome flow once we want to record completed signups.
// For now this base pixel records PageVisit on every consented page
// load, which is enough to attribute click-to-visit performance per
// ad in the Reddit Ads dashboard.

import Script from "next/script";

const FALLBACK_PIXEL_ID = "a2_j41cz8oveez7";

export function RedditPixel() {
  const pixelId = process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID ?? FALLBACK_PIXEL_ID;
  if (!pixelId) return null;

  return (
    <Script
      id="reddit-rdt-base"
      strategy="afterInteractive"
      // dangerouslySetInnerHTML is the standard Next pattern for
      // third-party pixels that install a global function via an
      // IIFE — the Reddit-supplied snippet does exactly this.
      dangerouslySetInnerHTML={{
        __html: `
!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js?pixel_id=${pixelId}",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);rdt('init','${pixelId}');rdt('track', 'PageVisit');
        `.trim(),
      }}
    />
  );
}
