"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, EyeOff, Landmark, Power } from "lucide-react";
import { cn } from "@/lib/utils";

// Three-screen onboarding that runs BEFORE Plaid Link opens. The goal:
// answer the three questions every non-technical user has about
// connecting their bank, in their own words, in 30 seconds.
//
// 1) What is Plaid?
// 2) What can / can't you do with my data?
// 3) Can I disconnect?
//
// On the third screen the user clicks "Connect my bank" which calls
// onComplete(), the parent then renders ConnectBankButton and the user
// proceeds into Plaid Link.

type Props = {
  onComplete: () => void;
};

const SLIDES = [
  {
    icon: Landmark,
    title: "Same connection your bank app uses",
    body: "Frugavo connects through Plaid — the secure service behind Venmo, Chime, Robinhood, and most banking apps. Your bank credentials never touch our servers.",
  },
  {
    icon: EyeOff,
    title: "Read-only. We can't move money.",
    body: "We can see your recurring charges to spot subscriptions. We cannot transfer money, change account settings, or send messages from your bank. No card numbers stored.",
  },
  {
    icon: Power,
    title: "Disconnect anytime",
    body: "One click in Settings revokes our access on Plaid's side and wipes the connection from our database. Your data is yours.",
  },
];

export function ConnectCarousel({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const last = SLIDES.length - 1;
  const slide = SLIDES[step];
  const Icon = slide.icon;

  return (
    <div className="rounded-3xl bg-white border border-hairline/60 shadow-soft overflow-hidden">
      <div className="p-7 md:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">
          <Icon size={22} />
        </div>

        <h2 className="mt-5 font-display text-[24px] md:text-[28px] font-bold tracking-[-0.02em] text-ink leading-tight">
          {slide.title}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-body">
          {slide.body}
        </p>

        {/* Dots */}
        <div className="mt-6 flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-brand" : "w-1.5 bg-ink/15"
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-7 md:px-9 py-4 border-t border-hairline/60 bg-canvas/60">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink hover:bg-ink/[0.04] transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        {step < last ? (
          <button
            onClick={() => setStep((s) => Math.min(last, s + 1))}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink/85 transition"
          >
            Next
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-[13.5px] font-medium text-white hover:bg-accent-hover transition"
          >
            Connect my bank
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
