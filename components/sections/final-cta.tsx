"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Confetti } from "@/components/shared/confetti";
import { FadeIn } from "@/components/motion/fade-in";
import { finalCta } from "@/lib/content";

// Encode the submission as application/x-www-form-urlencoded so Netlify Forms
// can pick it up. The static <form name="waitlist" data-netlify="true">
// declaration in app/layout.tsx lets Netlify register the form at build time;
// every POST to "/" carrying `form-name=waitlist` is captured server-side.
function encode(data: Record<string, string>) {
  return Object.keys(data)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(data[k]))
    .join("&");
}

export function FinalCta() {
  const [email, setEmail] = useState("");
  const [botField, setBotField] = useState(""); // honeypot
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email.");
      return;
    }

    setSubmitting(true);
    try {
      // Submit to Netlify Forms. We POST to /__forms.html (the static file
      // Netlify registered at deploy time) rather than to /. On Next.js +
      // @netlify/plugin-nextjs, the Next handler claims / and answers the
      // POST itself before Netlify's form middleware can intercept. Posting
      // to /__forms.html bypasses the Next handler and lets Netlify capture.
      await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode({
          "form-name": "waitlist",
          "bot-field": botField,
          email,
        }),
      });

      // Also write to Supabase if configured. Failures here are non-fatal —
      // Netlify keeps the canonical record.
      try {
        await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      } catch {
        // ignore
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
                  name="waitlist"
                  method="POST"
                  data-netlify="true"
                  data-netlify-honeypot="bot-field"
                  className="flex flex-col sm:flex-row items-stretch gap-2 rounded-full sm:bg-white sm:p-1.5 sm:shadow-float sm:border sm:border-hairline/60"
                >
                  {/* Hidden form-name input lets Netlify identify the
                      submission server-side. */}
                  <input type="hidden" name="form-name" value="waitlist" />
                  {/* Honeypot field — visible only to bots. */}
                  <input
                    type="text"
                    name="bot-field"
                    value={botField}
                    onChange={(e) => setBotField(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden="true"
                  />
                  <Input
                    type="email"
                    name="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-label="Email"
                    disabled={submitting}
                    className="sm:border-0 sm:bg-transparent sm:shadow-none sm:h-12"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting}
                    className="sm:h-12 sm:px-6"
                  >
                    {submitting ? "Adding…" : finalCta.button}
                    {!submitting && <ArrowRight size={16} />}
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
                    You&apos;re in.
                  </h3>
                  <p className="mt-1 text-[14px] text-ink-body">
                    We&apos;ll email you the moment your invite is ready.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <p className="mt-3 text-[13px] text-danger" role="alert">
                {error}
              </p>
            )}

            {/* Data-use disclosure required by Meta Ads policy for lead-
                capture forms. Visible directly under the form, not buried
                in the footer. */}
            {!submitted && (
              <p className="mt-4 text-[12px] text-ink-muted leading-relaxed">
                {finalCta.privacyNote}{" "}
                <a
                  href="/privacy"
                  className="underline decoration-ink-muted/40 underline-offset-2 hover:text-ink hover:decoration-ink"
                >
                  Privacy policy
                </a>
                .
              </p>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
