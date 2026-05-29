import type { MetadataRoute } from "next";

// Web App Manifest — the file that makes Frugavo installable on
// home screens via "Add to Home Screen" on iOS Safari and the
// native "Install" prompt on Android Chrome.
//
// Next.js App Router serves this at /manifest.webmanifest automatically
// when this file exists. No <link rel="manifest"> tag needed in layout.
//
// Naming:
//   name        = full product name shown in install dialogs
//   short_name  = home-screen label, capped at ~12 chars
//
// Display:
//   "standalone" gives the installed app its own window with no
//   browser chrome. That's the "feels like a native app" experience
//   the strategy is built around. We DO NOT use "fullscreen" — it
//   hides the iOS status bar, which fights the dashboard's safe-area
//   layout.
//
// Theme + background colors:
//   background_color shows on the splash screen during launch.
//     Frugavo canvas (#FAF8F4) so the splash blends into the app.
//   theme_color tints the address bar (browser tab) and the
//     status bar / nav bar on Android. We use ink (#0F172A) so
//     the chrome reads as premium-dark rather than washed-out
//     beige. Trade-off accepted — it makes the in-browser session
//     feel more app-like.
//
// Icons:
//   Two purposes per size:
//     "any"      — used as the literal icon (rounded by the OS)
//     "maskable" — used as the source for Android adaptive icons.
//                  The maskable variants have ~20% padding around
//                  the visual content so the OS can crop them into
//                  whatever shape (circle, squircle, droplet) the
//                  user's launcher prefers.
//
// Scope:
//   "/" so the installed PWA captures every Frugavo URL — the user
//   tapping a /app/subscriptions/123 link from email opens INSIDE
//   the installed app, not in browser Safari.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frugavo — Subscription Protection",
    short_name: "Frugavo",
    description:
      "Frugavo watches every recurring charge on your accounts and surfaces what changed — price hikes, trial conversions, forgotten subscriptions. Calm protection in the background.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF8F4",
    theme_color: "#0F172A",
    categories: ["finance", "productivity", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
