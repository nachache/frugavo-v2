import * as Sentry from "@sentry/nextjs";

// Server-side Sentry init. Captures uncaught exceptions and errors
// passed to Sentry.captureException() from API routes and server
// components. Performance tracing is off — we don't need it yet and
// it adds latency to every request.

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0,
    // Strip sensitive fields before sending.
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });
}
