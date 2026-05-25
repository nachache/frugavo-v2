"use client";

// Global 500 error boundary. App Router renders this when an unhandled
// error bubbles out of a server or client component. It MUST be a
// client component (the framework requires `"use client"`) and it MUST
// export `reset` so users can retry without reloading the whole page.
//
// We don't show the raw stack trace — that leaks implementation details
// and looks unprofessional. We do show error.digest (Next's hash of
// the actual error) so the user can paste it into a support email
// and we can correlate with Sentry logs.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[app/error] uncaught:", error);
  }, [error]);

  return (
    <section className="container-page py-20 md:py-32 max-w-[680px]">
      <span className="text-[13px] font-medium text-brand">
        Something broke
      </span>
      <h1 className="mt-2 font-display text-[36px] md:text-[52px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Hold on — we hit an error.
      </h1>
      <p className="mt-5 text-[16px] md:text-[17px] leading-relaxed text-ink-body">
        Frugavo is still watching your accounts in the background. The page
        you were on failed to load — try again, or head back to your dashboard.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-hover transition"
        >
          Try again
        </button>
        <a
          href="/app"
          className="inline-flex h-12 items-center gap-2 rounded-full border border-hairline bg-surface px-6 text-[15px] font-medium text-ink hover:bg-ink/[0.04] transition"
        >
          Go to dashboard
        </a>
      </div>
      {error.digest && (
        <p className="mt-10 text-[12px] text-ink-muted">
          Reference ID: <code className="rounded bg-ink/[0.05] px-1.5 py-0.5">{error.digest}</code>
          {" — include this if you contact "}
          <a
            href="mailto:hello@frugavo.com"
            className="text-ink underline underline-offset-2"
          >
            hello@frugavo.com
          </a>
          .
        </p>
      )}
    </section>
  );
}
