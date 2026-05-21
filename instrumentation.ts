// Next.js 14 instrumentation entrypoint.
//
// Runs once per server process. We use it to initialize Sentry on the
// server + edge runtimes. The client-side init lives in
// instrumentation-client.ts (loaded automatically by Next 14).
//
// Sentry is fully optional — when SENTRY_DSN is unset every call is a
// no-op, so dev and preview environments don't need it.

export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
