import * as Sentry from "@sentry/nextjs";

// Edge runtime init — for Next middleware, edge functions, and any
// route configured with runtime='edge'. Most of our routes are nodejs,
// but middleware.ts (Clerk gate) runs on the edge.

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0,
  });
}
