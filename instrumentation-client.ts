import * as Sentry from "@sentry/nextjs";

// Browser-side init. Next 14 picks this file up automatically. We
// gate on NEXT_PUBLIC_SENTRY_DSN (exposed to the client) so users
// without Sentry configured don't load the SDK.

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENV ??
      (process.env.NODE_ENV === "production" ? "production" : "development"),
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    integrations: [],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
