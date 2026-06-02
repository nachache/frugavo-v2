import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that require a signed-in user. Everything else (the marketing
// site, /learn, /about, /roadmap, /privacy, /terms) is public.
const isProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/api/app/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // In the installed @clerk/nextjs version, `auth` is a function that
  // returns the auth context. Invoke it, then call .protect() on the
  // result. The older `auth.protect()` form (no parentheses) was the
  // pre-2024 pattern and now produces a TypeScript error.
  if (isProtectedRoute(req)) {
    auth().protect();
  }
});

export const config = {
  // Performance: narrowed matcher. Previously this ran on every page
  // including the marketing landing, adding ~500ms TTFB from Clerk's
  // session-cookie decode + JWT verification on requests that don't
  // need any of that. Cold ad traffic was paying that latency tax on
  // first paint, contributing to the 8-second mobile bounce.
  //
  // Now Clerk middleware runs ONLY on routes that actually need it:
  //   • /app/*           — authenticated dashboard
  //   • /api/app/*       — authenticated app APIs
  //   • /api/admin/*     — admin allowlist surfaces
  //   • /api/user/*      — per-user preference APIs
  //   • /api/scan/*      — scan + rescan endpoints (need auth)
  //   • /api/learning/*  — event tracking (uses session for user_id)
  //   • /api/feedback/*  — beta feedback
  //   • /api/plaid/*     — Plaid Link token + exchange
  //   • /api/subscriptions/* /api/cancellations/* — user-scoped writes
  //   • /api/billing/*   — Stripe portal entry
  //   • /sign-in/*       — Clerk SignIn component needs middleware
  //   • /sign-up/*       — Clerk SignUp component needs middleware
  //   • /u/*             — public profile pages (use currentUser conditionally)
  //
  // Explicitly EXCLUDED — the marketing surface, which renders without
  // any session check and now ships with near-zero server latency:
  //   /, /about, /learn, /privacy, /terms, /roadmap,
  //   /api/stripe/webhook (Stripe signs the body; no Clerk needed),
  //   /api/cron/*, /api/health, /api/og, /api/clerk/* (Clerk webhooks
  //   verify via their own header signature, not session).
  matcher: [
    "/app/:path*",
    "/api/app/:path*",
    "/api/admin/:path*",
    "/api/user/:path*",
    "/api/scan/:path*",
    "/api/learning/:path*",
    "/api/feedback/:path*",
    "/api/plaid/:path*",
    "/api/subscriptions/:path*",
    "/api/cancellations/:path*",
    "/api/billing/:path*",
    "/api/ingestion/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/u/:path*",
  ],
};
