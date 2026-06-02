import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft, AlertTriangle, EyeOff, Lock } from "lucide-react";
import { LANDING } from "@/lib/landing/constants";

// /sample — zero-bank-required preview of what a Frugavo report
// looks like. Linked from the hero's secondary CTA ("See a sample
// report") to address the trust-to-ask gap: cold visitors get to
// see the OUTPUT before being asked to connect a bank.
//
// Static page. No Plaid call, no Supabase call, no auth. The list
// below is hand-crafted mock data designed to mirror a believable
// real report so the visitor feels "yes, this is what I'd find
// for me." Two charges are flagged as forgotten — exactly the
// pattern Frugavo surfaces in production.
//
// Scope guardrail: this page reads from lib/landing/constants only.
// No imports from lib/scan, lib/selectors, or anything in /app/*.

export const metadata: Metadata = {
  title: "Sample report · Frugavo",
  description:
    "What a Frugavo report looks like — sample data, no bank connection required.",
};

type SampleSub = {
  id: string;
  name: string;
  category: string;
  amountUsd: number;
  cadence: "Monthly" | "Annual ÷ 12";
  initial: string;
  glyphBg: string;
  flag?: "forgotten" | "review";
  note?: string;
};

// Hand-crafted to mirror the hero demo card brands so the experience
// reads as a continuation, not a separate product. The two flagged
// rows (Paddle.net unknown merchant, the Adobe trial that auto-renewed)
// are the kind of charges users actually forget about.
const SAMPLE_SUBS: SampleSub[] = [
  { id: "netflix", name: "Netflix", category: "Streaming", amountUsd: 22.99, cadence: "Monthly", initial: "N", glyphBg: "#E50914" },
  { id: "spotify", name: "Spotify Family", category: "Music", amountUsd: 16.99, cadence: "Monthly", initial: "S", glyphBg: "#1DB954" },
  { id: "apple", name: "Apple Services", category: "iCloud + App Store", amountUsd: 9.99, cadence: "Monthly", initial: "A", glyphBg: "#0A0A0A" },
  { id: "google", name: "Google Storage", category: "One · 100GB", amountUsd: 2.99, cadence: "Monthly", initial: "G", glyphBg: "#4285F4" },
  { id: "msft", name: "Microsoft 365", category: "Auto-renewed", amountUsd: 10.99, cadence: "Monthly", initial: "M", glyphBg: "#5E5E5E", flag: "review", note: "Renewed last week. Use the past 30 days?" },
  { id: "amazon", name: "Amazon Prime", category: "Annual ÷ 12", amountUsd: 14.99, cadence: "Annual ÷ 12", initial: "A", glyphBg: "#FF9900" },
  { id: "paddle", name: "Paddle.net", category: "Unknown merchant", amountUsd: 24.00, cadence: "Monthly", initial: "P", glyphBg: "#5C5CFF", flag: "forgotten", note: "Started 7 months ago. Do you recognize this charge?" },
  { id: "adobe", name: "Adobe Creative Cloud", category: "Single-app · Photoshop", amountUsd: 22.99, cadence: "Monthly", initial: "A", glyphBg: "#FA0F00", flag: "forgotten", note: "Free trial converted on Feb 14. $137.94 charged so far." },
  { id: "nyt", name: "New York Times", category: "All-access digital", amountUsd: 17.00, cadence: "Monthly", initial: "T", glyphBg: "#0A0A0A" },
  { id: "linkedin", name: "LinkedIn Premium", category: "Career", amountUsd: 39.99, cadence: "Monthly", initial: "L", glyphBg: "#0A66C2" },
  { id: "iclou-extra", name: "iCloud+ 2TB", category: "Storage upgrade", amountUsd: 9.99, cadence: "Monthly", initial: "i", glyphBg: "#0A0A0A" },
];

const TOTAL_MONTHLY = SAMPLE_SUBS.reduce((s, r) => s + r.amountUsd, 0);
const FORGOTTEN_TOTAL = SAMPLE_SUBS.filter((s) => s.flag === "forgotten").reduce(
  (s, r) => s + r.amountUsd,
  0
);
const FORGOTTEN_COUNT = SAMPLE_SUBS.filter((s) => s.flag === "forgotten").length;

const fmtUsd = (n: number) =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function SamplePage() {
  return (
    <main className="min-h-screen bg-canvas">
      {/* Top bar — link back to the landing page */}
      <header className="border-b border-hairline/60">
        <div className="container-page py-4 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-body hover:text-ink transition"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            Back to Frugavo
          </Link>
          <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Sample report
          </span>
        </div>
      </header>

      <section className="container-page py-8 md:py-12 max-w-[760px]">
        {/* Disclosure — first thing visitors see */}
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[13px] text-amber-900 leading-relaxed"
          role="note"
        >
          <span className="font-semibold">Sample data.</span> This is a realistic
          example of a Frugavo report. Your real report will show your actual
          subscriptions, flagged in the same way, after you connect your bank.
        </div>

        {/* Headline + totals card */}
        <div className="mt-6 rounded-3xl border border-hairline bg-white shadow-soft p-6 md:p-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Your subscriptions
          </div>
          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <span className="font-display text-[36px] md:text-[44px] font-bold tracking-[-0.02em] tabular-nums text-ink leading-none">
              {fmtUsd(TOTAL_MONTHLY)}
            </span>
            <span className="text-ink-muted text-[15px]">/mo</span>
            <span className="text-ink-muted/70 text-[14px]">
              · {SAMPLE_SUBS.length} subscriptions detected
            </span>
          </div>

          {FORGOTTEN_COUNT > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-[12.5px] font-semibold text-amber-900">
              <AlertTriangle size={13} strokeWidth={2.5} />
              {FORGOTTEN_COUNT} forgotten — {fmtUsd(FORGOTTEN_TOTAL)}/mo
            </div>
          )}
        </div>

        {/* Subscription list */}
        <ul className="mt-6 grid gap-2">
          {SAMPLE_SUBS.map((sub) => (
            <li
              key={sub.id}
              className={[
                "rounded-2xl border bg-white shadow-soft px-4 py-3 md:px-5 md:py-4 flex items-center gap-3 md:gap-4",
                sub.flag === "forgotten"
                  ? "border-amber-300"
                  : sub.flag === "review"
                    ? "border-amber-200"
                    : "border-hairline",
              ].join(" ")}
            >
              {/* Glyph */}
              <span
                className="flex-shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center text-white font-display font-bold text-[15px]"
                style={{ background: sub.glyphBg }}
                aria-hidden="true"
              >
                {sub.initial}
              </span>

              {/* Name + category */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14.5px] md:text-[15px] font-semibold text-ink">
                    {sub.name}
                  </span>
                  {sub.flag === "forgotten" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-amber-900">
                      <EyeOff size={10} strokeWidth={2.5} />
                      Forgotten
                    </span>
                  )}
                  {sub.flag === "review" && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-amber-900">
                      Review
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink-muted">
                  {sub.category}
                </div>
                {sub.note && (
                  <div className="mt-1.5 text-[12px] text-amber-900/85 leading-relaxed">
                    {sub.note}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="text-right shrink-0">
                <div className="text-[14.5px] md:text-[15px] font-semibold text-ink tabular-nums">
                  {fmtUsd(sub.amountUsd)}
                </div>
                <div className="text-[11px] text-ink-muted">{sub.cadence}</div>
              </div>
            </li>
          ))}
        </ul>

        {/* End-of-list CTA card */}
        <div className="mt-10 rounded-3xl border border-hairline bg-white shadow-soft p-6 md:p-8 text-center">
          <h2 className="font-display text-[22px] md:text-[28px] font-bold tracking-[-0.02em] text-ink leading-tight">
            Curious what we&apos;d find in yours?
          </h2>
          <p className="mt-2 text-[14px] text-ink-body max-w-[440px] mx-auto leading-relaxed">
            Connect your bank in {LANDING.timeToValue.display}. Read-only via Plaid.
            Same security used by {LANDING.plaidPartners.join(" & ")}. Free during
            early access.
          </p>
          <div className="mt-6 inline-flex flex-col items-center gap-2">
            <Link
              href="/sign-up"
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(4,120,87,0.45)] hover:bg-brand/90 transition"
            >
              Find my subscriptions
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <Lock size={11} strokeWidth={2} />
              Read-only · {LANDING.timeToValue.display} · no signup to preview
            </span>
          </div>
        </div>

        <p className="mt-8 text-[11.5px] text-ink-muted/80 leading-relaxed text-center">
          Source: {LANDING.source}. The average household pays $
          {LANDING.household.annualUsd.toLocaleString("en-US")}/yr in
          subscriptions — about ${LANDING.forgotten.monthlyTotalUsd}/mo of it
          goes to {LANDING.forgotten.countMin}–{LANDING.forgotten.countMax}{" "}
          charges most people don&apos;t realize they&apos;re paying for.
        </p>
      </section>
    </main>
  );
}
