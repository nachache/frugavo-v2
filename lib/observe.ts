import * as Sentry from "@sentry/nextjs";

// Thin wrapper around Sentry so the rest of the codebase doesn't have
// to import @sentry/nextjs in every file. Also keeps the call site
// readable: `observeError(e, { route: 'scan' })` reads better than the
// raw Sentry API.
//
// All functions are no-ops when SENTRY_DSN is unset.

type Tags = Record<string, string>;

export function observeError(
  err: unknown,
  context: { route?: string; tags?: Tags; extra?: Record<string, unknown> } = {}
): void {
  // Always log to console too so Netlify function logs still have it.
  // eslint-disable-next-line no-console
  console.error(`[${context.route ?? "app"}]`, err);
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context.route) scope.setTag("route", context.route);
    if (context.tags) {
      for (const [k, v] of Object.entries(context.tags)) {
        scope.setTag(k, v);
      }
    }
    if (context.extra) {
      for (const [k, v] of Object.entries(context.extra)) {
        scope.setExtra(k, v);
      }
    }
    Sentry.captureException(err);
  });
}

export function observeMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  tags: Tags = {}
): void {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(tags)) {
      scope.setTag(k, v);
    }
    Sentry.captureMessage(message, level);
  });
}
