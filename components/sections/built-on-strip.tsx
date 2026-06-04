"use client";

import { FadeIn } from "@/components/motion/fade-in";
import { LANDING } from "@/lib/landing/constants";

// "Built on" infrastructure trust strip — Phase G, pro-polish v2.
//
// v1 rendered Plaid/Stripe/Supabase as big Fraunces-serif wordmarks,
// which looked nothing like those brands' actual identity and read
// as a generic SaaS imitation. v2 renders each partner inside a
// quiet pill ("Plaid · Bank linking") with subtle brand-tinted dots,
// which sets up the infrastructure-trust narrative without trying
// to ape brand logos we don't own. The hard numbers underneath do
// the bigger visual lifting.
//
// Visual rhythm: small eyebrow caps, three restrained partner chips
// on one row, divider, three big brand-green stats. Dense and
// confident, not loud.

const STATS: ReadonlyArray<{ value: string; label: string }> = [
  { value: `${LANDING.banks.display}`, label: "banks via Plaid" },
  { value: "2,000+", label: "subscription providers detected" },
  { value: "60s", label: "to your first results" },
];

const PARTNERS: ReadonlyArray<{ name: string; sub: string; dot: string }> = [
  { name: "Plaid",    sub: "Bank linking",       dot: "#5469D4" },
  { name: "Stripe",   sub: "Payment processing", dot: "#635BFF" },
  { name: "Supabase", sub: "Encrypted data",     dot: "#3ECF8E" },
];

export function BuiltOnStrip() {
  return (
    <section
      aria-labelledby="built-on-heading"
      className="py-14 md:py-20 border-y border-hairline/50 bg-white/50"
    >
      <div className="container-page">
        <FadeIn>
          {/* Section eyebrow */}
          <p
            id="built-on-heading"
            className="text-center text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-body/75"
          >
            Trusted infrastructure
          </p>

          {/* Partner chips — refined: each in a quiet pill that looks
              like a credibility note, not a knockoff logo. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {PARTNERS.map((p) => (
              <div
                key={p.name}
                className="inline-flex items-center gap-2 rounded-full bg-white border border-hairline px-3.5 py-2 shadow-[0_1px_2px_rgba(10,10,10,0.04)]"
              >
                <span
                  aria-hidden="true"
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: p.dot }}
                />
                <span className="font-display text-[14px] font-bold tracking-[-0.01em] text-ink">
                  {p.name}
                </span>
                <span className="text-ink-body/40 text-[12px]" aria-hidden="true">
                  ·
                </span>
                <span className="text-[12px] text-ink-body whitespace-nowrap">
                  {p.sub}
                </span>
              </div>
            ))}
          </div>

          {/* Quiet divider */}
          <div className="mt-10 mx-auto max-w-[120px] border-t border-hairline/50" />

          {/* Hard numbers — restrained scale, tighter spacing, hairline
              dividers between stats on tablet+ */}
          <div className="mt-10 grid grid-cols-3 max-w-[760px] mx-auto sm:divide-x sm:divide-hairline/40">
            {STATS.map((s) => (
              <div key={s.label} className="text-center px-2 sm:px-4">
                <div className="font-display text-[26px] sm:text-[32px] md:text-[40px] font-bold tracking-[-0.03em] text-ink tnum leading-none">
                  {s.value}
                </div>
                <div className="mt-2.5 text-[11.5px] sm:text-[12.5px] md:text-[13px] text-ink-body leading-snug max-w-[180px] mx-auto">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
