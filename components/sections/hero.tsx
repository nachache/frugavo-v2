"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";

// Client-only: the HeroDemoCard relies on refs, animation loops, and
// CSS-in-JS that only kick in after hydration. SSR'd it bleeds raw
// "Step 1 of 3 / Connecting securely / $0.00/mo / 0 charges" text
// into the first paint before styles apply. Disabling SSR + a sized
// placeholder eliminates the flash and prevents layout shift.
const HeroDemoCard = dynamic(
  () =>
    import("@/components/sections/hero-demo-card").then((m) => m.HeroDemoCard),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="rounded-3xl border border-hairline bg-canvas/40"
        style={{ minHeight: 560 }}
      />
    ),
  }
);
import { hero } from "@/lib/content";

// Hero is wired for ad-to-page continuity. A visitor arriving from the
// "You're paying for 14 subscriptions and can name 9" X post should
// land here and immediately feel: "Frugavo is about to show me the
// ones I forgot." Every element supports that single narrative:
//
//   • Headline names the outcome the ad implied (forgotten charges
//     still billing today), instead of resetting the conversation.
//   • Demo card on the right shows shell-company-style merchant
//     names (Paddle.net, Apple Services) — the ones cold readers
//     don't recognize on their own statements.
//   • Trust signals sit ABOVE the CTA because bank-credential
//     anxiety is the largest barrier here, and it has to be
//     addressed before we ask.
//   • Single CTA. The previous "See how it works" secondary action
//     was conversion drag — How-it-works lives one scroll down and
//     curious readers still get there.

export function Hero() {
  return (
    <section className="relative pt-12 md:pt-20 pb-20 md:pb-28 overflow-hidden">
      {/* Drifting blob backdrop — emerald onto cream, very low opacity. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 -right-20 h-[640px] w-[640px] rounded-full bg-gradient-to-br from-emerald-200/40 via-emerald-100/30 to-transparent blur-3xl animate-blob" />
        <div className="absolute top-[20%] -left-32 h-[480px] w-[480px] rounded-full bg-gradient-to-br from-amber-100/30 to-transparent blur-3xl animate-blob [animation-delay:-8s]" />
      </div>

      <div className="container-page grid lg:grid-cols-[55fr_45fr] gap-12 lg:gap-16 items-center">
        {/* LEFT */}
        <div className="max-w-[640px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Badge tone="brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {hero.eyebrow}
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-6 font-display font-bold text-ink text-[34px] md:text-[52px] leading-[1.04] tracking-[-0.03em]"
          >
            {hero.headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.14,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-5 max-w-[560px] text-[16.5px] md:text-[19px] leading-relaxed text-ink-body"
          >
            {hero.subheadline}
          </motion.p>

          {/* Quantified social proof — the closest thing we have to a
              testimonial pre-launch. Uses third-party research (C+R
              2026) so the number reads as observation, not marketing
              claim. Sits between the subheadline and the trust checks
              so cold visitors meet a concrete figure before they
              meet the safety story. */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.18,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-5 max-w-[520px] text-[14px] md:text-[15px] leading-relaxed text-ink-body/85"
          >
            <span className="font-display font-bold italic text-ink">
              {hero.statLine.figure}
            </span>{" "}
            {hero.statLine.body}.{" "}
            <span className="text-ink-muted text-[12.5px]">
              {hero.statLine.source}
            </span>
          </motion.p>

          {/* Trust signals — sits ABOVE the CTA. Cold ad traffic needs
              to see the credential-safety story before the bank-connect
              ask, not after. Compact two-column grid on desktop so the
              row doesn't visually compete with the headline. */}
          <motion.ul
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.22,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 max-w-[460px]"
          >
            {hero.trustChecks.map((t) => (
              <li
                key={t}
                className="inline-flex items-center gap-2 text-[13.5px] text-ink-body"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-light shrink-0">
                  <Check size={11} className="text-brand" strokeWidth={3} />
                </span>
                <span className="leading-tight">{t}</span>
              </li>
            ))}
          </motion.ul>

          {/* Single CTA. The page has ONE obvious action above the
              fold; the rest of the page handles the rest of the
              conversation. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.3,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-6"
          >
            <Button asChild size="lg" className="group">
              <a href={hero.primaryCta.href}>
                {hero.primaryCta.label}
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-0.5"
                />
              </a>
            </Button>
          </motion.div>

          {/* Reassurance line directly under the CTA. Bank-credential
              anxiety is the largest conversion barrier on cold finance
              traffic. Promising the off-ramp before the user commits
              reduces the "am I locked in?" fear. Small text, brand
              emerald dot for warmth instead of a stark icon. */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.36 }}
            className="mt-4 inline-flex items-center gap-2 text-[13px] text-ink-muted"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
            {hero.reassurance}
          </motion.p>
        </div>

        {/* RIGHT — animated discovery scan. Visible on mobile too;
            the visual proof reinforces the headline by showing the
            kind of merchant names users typically don't recognize. */}
        <div className="relative">
          <HeroDemoCard />
        </div>
      </div>
    </section>
  );
}
