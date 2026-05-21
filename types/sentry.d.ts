// Minimal type shim for @sentry/nextjs.
//
// The real types ship with the package and will take precedence when
// present. This shim exists as a fallback so the build doesn't fail
// in environments where the install dropped only the .d.ts.map files
// (seen occasionally on read-only or low-quota CI runners). On a
// normal `npm install` the actual Sentry types resolve first.
//
// Only the surface we actually call is declared here. If we start
// using more of the SDK, extend this shim or remove it once npm
// reliably ships the full types.

declare module "@sentry/nextjs" {
  export interface Scope {
    setTag(key: string, value: string): void;
    setExtra(key: string, value: unknown): void;
  }

  export type SeverityLevel = "fatal" | "error" | "warning" | "info" | "debug";

  export interface SentryEvent {
    request?: {
      cookies?: unknown;
      headers?: Record<string, string | undefined>;
    };
  }

  export interface SentryInitOptions {
    dsn: string;
    environment?: string;
    tracesSampleRate?: number;
    replaysSessionSampleRate?: number;
    replaysOnErrorSampleRate?: number;
    integrations?: unknown[];
    beforeSend?: (event: SentryEvent) => SentryEvent | null;
  }

  export function init(opts: SentryInitOptions): void;
  export function captureException(err: unknown): void;
  export function captureMessage(message: string, level?: SeverityLevel): void;
  export function withScope(callback: (scope: Scope) => void): void;
  export const captureRouterTransitionStart: (
    href: string,
    navigationType: string
  ) => void;
}
