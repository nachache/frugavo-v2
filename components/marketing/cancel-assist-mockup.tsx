// Static cancel-assist panel mockup — feature-spotlight visual for
// the "Cancel anything in one tap" section. Phase G (2026-06-05).
//
// Shows the cancel-assist slide-over: which provider, the prepared
// language, and the "we'll watch the next billing cycle" promise.
// Critical visual proof that Frugavo doesn't take a cut of the
// cancellation — the user does it themselves.

import { ArrowRight, CheckCircle2, Copy, ExternalLink } from "lucide-react";

export function CancelAssistMockup() {
  return (
    <figure
      className="rounded-3xl border border-hairline bg-white shadow-[0_24px_60px_-30px_rgba(10,10,10,0.18)] overflow-hidden max-w-[440px] mx-auto"
      aria-label="Sample cancel-assist panel — direct link to provider cancel page with prepared language."
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-hairline/60">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
          Cancel-assist
        </div>
        <h3 className="mt-1 font-display text-[20px] font-bold tracking-[-0.015em] text-ink leading-tight">
          Cancel HelloFresh
        </h3>
        <p className="mt-1 text-[12px] text-ink-body">
          You&apos;ll be on the real HelloFresh cancel page in one click.
        </p>
      </div>

      {/* Steps */}
      <div className="px-5 py-4 space-y-3">
        <Step
          num={1}
          title="Open HelloFresh's cancel page"
          body="Direct link — we don't redirect you through any partner."
        />
        <Step
          num={2}
          title="Paste this if they ask why"
          body=""
        >
          <div className="mt-2 rounded-lg bg-ink/[0.04] border border-hairline/70 p-3">
            <p className="text-[12px] text-ink-body italic leading-relaxed">
              &ldquo;I&apos;m taking a break from meal kits. Please cancel my
              account effective at the end of the current cycle.&rdquo;
            </p>
            <button
              type="button"
              tabIndex={-1}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-brand/80 transition"
            >
              <Copy size={10} strokeWidth={2.5} aria-hidden />
              Copy to clipboard
            </button>
          </div>
        </Step>
        <Step
          num={3}
          title="We confirm via your bank"
          body="Frugavo watches the next billing cycle. If the charge stops, you'll see a green ✓. If it sneaks back, we tell you."
        />
      </div>

      {/* Primary CTA */}
      <div className="mx-4 mb-3">
        <button
          type="button"
          tabIndex={-1}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-ink text-white text-[13px] font-semibold h-11 hover:bg-ink/85 transition"
        >
          Open HelloFresh cancel page
          <ExternalLink size={12} strokeWidth={2.5} aria-hidden />
          <ArrowRight size={12} strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      {/* "We don't take a cut" disclosure */}
      <div className="mx-4 mb-4 rounded-xl bg-brand/[0.06] border border-brand/15 p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} strokeWidth={2.2} className="text-brand shrink-0 mt-0.5" aria-hidden />
          <p className="text-[12px] text-ink-body leading-relaxed">
            <span className="font-semibold text-ink">Frugavo never takes a cut.</span>{" "}
            You cancel directly with the provider — we just guide you and
            confirm it worked.
          </p>
        </div>
      </div>

      <figcaption className="px-5 py-2.5 bg-ink/[0.02] text-[10.5px] text-ink-body/80 text-center border-t border-hairline/60">
        Sample cancel-assist · mock data
      </figcaption>
    </figure>
  );
}

function Step({
  num,
  title,
  body,
  children,
}: {
  num: number;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="shrink-0 w-6 h-6 rounded-full bg-brand/12 text-brand text-[11px] font-bold flex items-center justify-center"
      >
        {num}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink">{title}</div>
        {body && (
          <p className="mt-0.5 text-[12px] text-ink-body leading-relaxed">{body}</p>
        )}
        {children}
      </div>
    </div>
  );
}
