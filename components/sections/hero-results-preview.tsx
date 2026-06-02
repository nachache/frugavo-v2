// Static results-screen preview for the hero (R5).
//
// Replaces the animated HeroDemoCard in the hero context. The brief
// asked for "a clean results-screen preview... showing a few detected
// subscriptions with amounts, 2–3 flagged 'forgotten'." Static beats
// animated here because:
//   • Faster LCP — no client-side JS animation loop blocks paint.
//   • The brief specifies "clean".
//   • Cold visitors land + immediately see what the OUTPUT looks like,
//     no waiting through a 3-second discovery animation.
//
// Mock data only. No imports from lib/scan, lib/selectors, or /app/*.
// The detailed /sample route remains the deep dive — this is the
// in-hero teaser.

import { AlertTriangle, EyeOff } from "lucide-react";

type PreviewRow = {
  id: string;
  name: string;
  category: string;
  amountUsd: number;
  initial: string;
  glyphBg: string;
  flag?: "forgotten" | "review";
};

// Six rows fit comfortably above the fold on mobile when paired with
// the header card. Two flagged "forgotten" matches the brief and
// mirrors the /sample report's flagging pattern. Brands chosen are
// the shell-merchant style names cold users are most likely to not
// recognize on their own statements.
const PREVIEW_ROWS: PreviewRow[] = [
  { id: "apple",   name: "Apple Services", category: "iCloud + App Store", amountUsd: 9.99,  initial: "A", glyphBg: "#0A0A0A" },
  { id: "google",  name: "Google Storage", category: "100GB",              amountUsd: 2.99,  initial: "G", glyphBg: "#4285F4" },
  { id: "msft",    name: "Microsoft 365",  category: "Auto-renewed",       amountUsd: 10.99, initial: "M", glyphBg: "#5E5E5E", flag: "review" },
  { id: "amazon",  name: "Amazon Prime",   category: "Annual ÷ 12",        amountUsd: 14.99, initial: "A", glyphBg: "#FF9900" },
  { id: "adobe",   name: "Adobe CC",       category: "Trial converted Feb 14", amountUsd: 22.99, initial: "A", glyphBg: "#FA0F00", flag: "forgotten" },
  { id: "paddle",  name: "Paddle.net",     category: "Unknown merchant",   amountUsd: 24.00, initial: "P", glyphBg: "#5C5CFF", flag: "forgotten" },
];

const TOTAL = PREVIEW_ROWS.reduce((s, r) => s + r.amountUsd, 0);
const FORGOTTEN_TOTAL = PREVIEW_ROWS.filter((r) => r.flag === "forgotten").reduce(
  (s, r) => s + r.amountUsd,
  0
);
const FORGOTTEN_COUNT = PREVIEW_ROWS.filter((r) => r.flag === "forgotten").length;

const fmtUsd = (n: number) =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function HeroResultsPreview() {
  return (
    <figure
      className="rounded-3xl border border-hairline bg-white shadow-[0_24px_60px_-30px_rgba(10,10,10,0.18)] overflow-hidden max-w-[420px] mx-auto lg:mx-0"
      // min-height matches the prior placeholder so the layout below
      // never shifts after this card mounts. Important for CLS.
      style={{ minHeight: 540 }}
      aria-label="Sample Frugavo report — six subscriptions detected, two flagged as forgotten."
    >
      {/* Header card — totals + forgotten badge */}
      <div className="px-5 pt-5 pb-4 border-b border-hairline/60">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-body">
          Your subscriptions
        </div>
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="font-display text-[28px] md:text-[32px] font-bold tracking-[-0.02em] tabular-nums text-ink leading-none">
            {fmtUsd(TOTAL)}
          </span>
          <span className="text-[13px] text-ink-body">/mo</span>
          <span className="text-[12px] text-ink-body/85">
            · {PREVIEW_ROWS.length} detected
          </span>
        </div>

        {FORGOTTEN_COUNT > 0 && (
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11.5px] font-semibold text-amber-900"
            role="status"
          >
            <AlertTriangle size={11} strokeWidth={2.5} aria-hidden="true" />
            {FORGOTTEN_COUNT} forgotten — {fmtUsd(FORGOTTEN_TOTAL)}/mo
          </div>
        )}
      </div>

      {/* Row list */}
      <ul className="px-3 py-3 space-y-1.5">
        {PREVIEW_ROWS.map((r) => (
          <li
            key={r.id}
            className={[
              "flex items-center gap-3 rounded-xl border px-3 py-2.5",
              r.flag === "forgotten"
                ? "border-amber-200 bg-amber-50/30"
                : r.flag === "review"
                  ? "border-amber-100 bg-white"
                  : "border-hairline/70 bg-white",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white text-[12px] font-bold"
              style={{ background: r.glyphBg }}
            >
              {r.initial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-semibold text-ink truncate">
                  {r.name}
                </span>
                {r.flag === "forgotten" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-amber-900">
                    <EyeOff size={9} strokeWidth={2.5} aria-hidden="true" />
                    Forgotten
                  </span>
                )}
                {r.flag === "review" && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-amber-900">
                    Review
                  </span>
                )}
              </div>
              <div className="text-[11px] text-ink-body/85 truncate">
                {r.category}
              </div>
            </div>
            <div className="text-[13px] font-semibold text-ink tabular-nums shrink-0">
              {fmtUsd(r.amountUsd)}
            </div>
          </li>
        ))}
      </ul>

      <figcaption className="px-5 py-3 border-t border-hairline/60 text-[10.5px] text-ink-body/80 text-center">
        Sample report · mock data
      </figcaption>
    </figure>
  );
}
