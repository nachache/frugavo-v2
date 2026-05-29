// Frugavo service worker — minimal installability shim.
//
// Why so small:
//   Frugavo is a dynamic Next.js app — every dashboard request goes
//   through React Server Components with up-to-the-second data. An
//   aggressive cache-first service worker would serve stale numbers
//   to the user (e.g. "you saved $X" against last week's data) and
//   stale html shells (which break the App Router's RSC payload
//   negotiation).
//
//   What we need this SW to do is much smaller:
//     1. Exist (so Chrome's beforeinstallprompt fires)
//     2. Have a fetch handler (also a precondition for installability)
//     3. Stay out of the way of every request (pure passthrough)
//
// If we add offline support later it goes BEHIND a route allowlist —
// static asset URLs (/icons/, /_next/static/) only, never the app
// shell or any /api route.
//
// Version: bump the constant when changing this file so existing
// clients update on next visit.

const SW_VERSION = "frugavo-sw-v1";

self.addEventListener("install", (event) => {
  // Activate the new SW immediately so version bumps reach users on
  // their NEXT navigation, not the visit AFTER that.
  self.skipWaiting();
  void event;
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Take control of all open tabs without requiring a reload.
      await self.clients.claim();
      // Clean up any old SW caches if a previous version of this
      // file had a cache-first strategy. Defensive — doesn't hurt.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SW_VERSION)
          .map((k) => caches.delete(k))
      );
    })()
  );
});

self.addEventListener("fetch", (event) => {
  // Pure passthrough. Lets the browser handle every request exactly
  // as it would without a SW. The handler exists ONLY so Chrome
  // counts the SW as a PWA installability prerequisite.
  //
  // We deliberately do NOT call event.respondWith() — the browser's
  // default network fetch runs as if no SW were registered.
  void event;
});
