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
  // Run on every route except Next internals and static assets. The Clerk
  // session check is cheap; gating is done inside the callback above.
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
