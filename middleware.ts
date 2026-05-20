import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that require a signed-in user. Everything else (the marketing
// site, /learn, /about, /roadmap, /privacy, /terms) is public.
const isProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/api/app/(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth.protect();
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
