"use client";

// X (Twitter) Ads conversion pixel.
//
// Wraps the standard `twq` base snippet in a Next/script so the script
// loads with strategy="afterInteractive" — fires after hydration so it
// doesn't block the initial paint, but still in time to record the
// page-view event that the X conversion attribution model needs.
//
// Gated by ConsentGate in app/layout.tsx so the pixel never installs
// for visitors who declined cookies.
//
// Pixel ID is centralised in NEXT_PUBLIC_X_PIXEL_ID env var so we can
// rotate it without code changes. Falls back to the production pixel
// id committed below if the env var is missing — first-deploy safety
// net so we don't lose tracking if someone forgets to set the var.

import Script from "next/script";

const FALLBACK_PIXEL_ID = "rcp5n";

export function XPixel() {
  const pixelId = process.env.NEXT_PUBLIC_X_PIXEL_ID ?? FALLBACK_PIXEL_ID;
  if (!pixelId) return null;

  return (
    <Script
      id="x-twq-base"
      strategy="afterInteractive"
      // dangerouslySetInnerHTML is the standard Next pattern for
      // third-party pixels that need to install a global function via
      // an IIFE — the X-supplied snippet does exactly this.
      dangerouslySetInnerHTML={{
        __html: `
!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
twq('config','${pixelId}');
        `.trim(),
      }}
    />
  );
}
