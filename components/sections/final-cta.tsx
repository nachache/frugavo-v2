"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { FadeIn } from "@/components/motion/fade-in";
import { finalCta } from "@/lib/content";

// Final CTA section — single Start Scan button. The mailing list /
// waitlist capture this used to host has been removed: we have a
// working signup flow, so collecting an email separately leaked
// users out of the funnel. One CTA, one destination.

export function FinalCta() {
  return (
    <section id="cta" className="py-24 md:py-32 relative overflow-hidden">
      {/* Soft brand-tinted background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 30%, rgba(16,185,129,0.10), transparent 70%), linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(250,250,250,1) 80%)",
        }}
      />

      <div className="container-page">
        <FadeIn>
          <div className="mx-auto max-w-[680px] text-center">
            <h2 className="text-[40px] md:text-[56px] font-display font-bold tracking-[-0.03em] leading-[1.05] text-ink">
              {finalCta.heading}
            </h2>
            <p className="mt-4 text-[18px] md:text-[19px] leading-relaxed text-ink-body">
              {finalCta.subhead}
            </p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="mt-8 flex flex-col items-center gap-3"
            >
              <Link
                href="/sign-up"
                className="group inline-flex h-14 items-center gap-2 rounded-full bg-brand px-8 text-[16px] font-semibold text-white shadow-soft hover:bg-brand-hover transition"
              >
                Start Scan
                <ArrowRight
                  size={18}
                  strokeWidth={2.5}
                  className="transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <div className="text-[13px] text-ink-muted">
                Free 30-second scan · No credit card · Read-only via Plaid
              </div>
            </motion.div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
