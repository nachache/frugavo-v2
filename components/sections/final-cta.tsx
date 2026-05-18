"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Confetti } from "@/components/shared/confetti";
import { FadeIn } from "@/components/motion/fade-in";
import { finalCta } from "@/lib/content";

const STORAGE_KEY = "frugavo:spotsRemaining";

export function FinalCta() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [spots, setSpots] = useState(247);

  // Persist a per-visitor "spots remaining" counter. We seed from server-side
  // default 247 so SSR/CSR markup matches, then sync from localStorage after
  // hydration to avoid a flash.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSpots(parseInt(stored, 10));
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return;
    // TODO: persist signup to Vercel KV when wiring up auth.  For now we log.
    // eslint-disable-next-line no-console
    console.log("[frugavo] waitlist signup:", email);
    setSubmitted(true);
    const next = Math.max(1, spots - 1);
    setSpots(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <section id="cta" className="py-28 md:py-36 bg-canvas">
      <div className="container-page text-center">
        <FadeIn>
          <h2 className="mx-auto max-w-[820px] text-[40px] md:text-[64px] font-display font-bold tracking-[-0.04em] leading-[1.02] text-ink">
            {finalCta.headline}
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[17px] md:text-[19px] text-ink-body">
            {finalCta.subhead}
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="relative mx-auto mt-10 max-w-[560px]">
            <AnimatePresence mode="wait">
              {!submitted ? (
                <motion.form
                  key="form"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={onSubmit}
                  className="flex flex-col sm:flex-row items-stretch gap-2 rounded-full sm:bg-white sm:p-1.5 sm:shadow-float sm:border sm:border-hairline/60"
                >
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-label="Email"
                    className="sm:border-0 sm:bg-transparent sm:shadow-none sm:h-12"
                  />
                  <Button type="submit" size="lg" className="sm:h-12 sm:px-6">
                    {finalCta.button}
                    <ArrowRight size={16} />
                  </Button>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="relative mx-auto rounded-3xl bg-white p-7 shadow-float border border-hairline/60"
                >
                  <div className="relative inline-block">
                    <Confetti />
                    <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white">
                      <Check size={22} strokeWidth={3} />
                    </span>
                  </div>
                  <h3 className="mt-4 text-[18px] font-display font-semibold text-ink">
                    You're in.
                  </h3>
                  <p className="mt-1 text-[14px] text-ink-body">
                    We'll email you the moment your invite is ready.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <p className="mt-6 text-[13px] text-ink-muted tnum">
            Spots remaining:{" "}
            <span className="font-semibold text-ink">{spots}</span> /{" "}
            {finalCta.initialSpots}
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
