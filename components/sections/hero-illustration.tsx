"use client";

import { ArrowDownRight, Bell, ShieldCheck } from "lucide-react";
import { BrandLogo, type BrandKey } from "@/components/marketing/brand-logo";

// Hero illustration — Phase G follow-up (2026-06-05), pro-polish v2.
//
// Composition: a floating phone device showing the Frugavo app, with
// two small "in-product" UI fragments floating around it — a "Frugavo
// noticed" notification pill at the top-left, and a "$22.99/mo
// detected" chip at the bottom-right. The two fragments balance the
// composition diagonally and demonstrate the product narrative
// without text needing to spell it out.
//
// Notable removals (v1 → v2):
//   • Dropped the hand silhouette SVG. It read amateurish (geometric
//     peach blob + triangle "sleeve" was uncanny). The clean
//     floating-device composition is the standard pro-fintech pattern
//     (Linear, Stripe, Cash App) and looks more polished.
//   • Dropped the dot grid in the corner. Decorative pattern with no
//     purpose. The notification chips do the "active in the corner"
//     job better.
//
// All animation is plain CSS keyframes — no Framer Motion in the
// hero bundle. Respects prefers-reduced-motion via the media query
// inside the styled-jsx block.

export function HeroIllustration() {
  return (
    <div
      className="relative w-full mx-auto"
      style={{ minHeight: 540, maxWidth: 420 }}
      aria-label="A floating phone showing the Frugavo app, surrounded by two small UI fragments — a 'Frugavo noticed' notification and a 'detected charge' chip."
    >
      {/* Soft gradient halo behind everything — brand-green core
          warming into amber, blurred. Reads as ambient light rather
          than a hard graphic element. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 flex items-center justify-center"
      >
        <div
          className="w-[88%] h-[78%] rounded-[42%] blur-3xl opacity-90"
          style={{
            background:
              "radial-gradient(60% 60% at 45% 40%, rgba(4,120,87,0.28), rgba(245,158,11,0.10) 55%, rgba(245,158,11,0) 75%)",
          }}
        />
      </div>

      {/* Floating notification pill, top-left */}
      <NotificationPill />

      {/* Phone with subscriptions card */}
      <PhoneFrame />

      {/* Floating "detected" chip, bottom-right */}
      <DetectedChip />

      {/* Local keyframes — no Tailwind plugin needed */}
      <style jsx>{`
        @keyframes hero-float {
          0%,
          100% {
            transform: translateY(0px) rotate(-1.5deg);
          }
          50% {
            transform: translateY(-6px) rotate(-1.5deg);
          }
        }
        @keyframes hero-pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.78;
            transform: scale(1.06);
          }
        }
        @keyframes hero-notif-in {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes hero-chip-in {
          0%,
          40% {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .hero-anim-float {
          animation: hero-float 6.5s ease-in-out infinite;
        }
        .hero-anim-pulse {
          animation: hero-pulse 2.6s ease-in-out infinite;
        }
        .hero-anim-notif {
          opacity: 0;
          animation: hero-notif-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) 1.4s
            forwards;
        }
        .hero-anim-chip {
          opacity: 0;
          animation: hero-chip-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) 2.2s
            forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-anim-float,
          .hero-anim-pulse {
            animation: none !important;
          }
          .hero-anim-notif,
          .hero-anim-chip {
            opacity: 1 !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function NotificationPill() {
  return (
    <div
      className="absolute left-2 top-4 sm:left-4 sm:top-6 md:-left-8 md:top-12 z-20 hero-anim-notif pointer-events-none max-w-[calc(100%-1rem)]"
    >
      <div className="inline-flex items-center gap-2.5 rounded-2xl bg-white shadow-[0_18px_40px_-16px_rgba(10,10,10,0.22)] border border-hairline/80 px-3.5 py-2.5 max-w-[250px]">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-amber-50 ring-1 ring-amber-200/60 shrink-0">
          <Bell size={14} strokeWidth={2.4} className="text-amber-700" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700">
            Frugavo noticed
          </div>
          <div className="text-[12.5px] font-medium text-ink leading-snug truncate">
            Adobe trial converts Friday
          </div>
        </div>
      </div>
    </div>
  );
}

function DetectedChip() {
  return (
    <div
      className="absolute right-2 bottom-12 sm:right-4 sm:bottom-16 md:-right-6 md:bottom-20 z-20 hero-anim-chip pointer-events-none"
    >
      <div className="inline-flex items-center gap-2.5 rounded-2xl bg-white shadow-[0_18px_40px_-16px_rgba(10,10,10,0.22)] border border-hairline/80 px-3.5 py-2.5 max-w-[230px]">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-brand/10 ring-1 ring-brand/25 shrink-0">
          <ShieldCheck size={14} strokeWidth={2.4} className="text-brand" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand">
            Detected
          </div>
          <div className="text-[12.5px] font-medium text-ink leading-snug truncate flex items-center gap-1">
            $22.99/mo from Paddle.net
            <ArrowDownRight size={11} strokeWidth={2.5} className="text-ink-body/60 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneFrame() {
  return (
    <div className="relative mx-auto hero-anim-float" style={{ width: 240 }}>
      {/* Phone outer frame — soft inner gradient + tighter shadow.
          Geometry tuned 2026-06-05 (round 2):
          • width 300 → 240, aspect 9/14 → 9/16. The 9/14 version
            looked too fat; modern phones are closer to 9/16. The
            narrower frame also makes the surrounding floating chips
            sit closer to the device. */}
      <div
        className="relative rounded-[34px] shadow-[0_40px_90px_-24px_rgba(10,10,10,0.45),0_8px_22px_-6px_rgba(10,10,10,0.18)] p-2"
        style={{
          aspectRatio: "9 / 16",
          background: "linear-gradient(160deg, #1a1a1a 0%, #0a0a0a 100%)",
        }}
      >
        {/* Dynamic island */}
        <div
          aria-hidden="true"
          className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 rounded-full bg-ink z-10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
        />

        {/* Screen */}
        <div className="relative h-full rounded-[28px] bg-canvas overflow-hidden flex flex-col">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 text-[10px] font-semibold text-ink/85 tnum">
            <span>9:41</span>
            <div className="flex items-center gap-1.5 text-ink/70">
              {/* Signal / wifi / battery glyphs as simple shapes */}
              <span className="inline-block w-3 h-1.5 rounded-[1px] border border-current border-r-[3px]" aria-hidden />
            </div>
          </div>

          {/* App header */}
          <div className="px-5 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-body">
                  Your subscriptions
                </div>
                <div className="mt-0.5 font-display text-[24px] font-bold tracking-[-0.025em] text-ink leading-none tnum">
                  $85.94<span className="text-[11px] font-medium text-ink-body ml-1">/mo</span>
                </div>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 shrink-0">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand hero-anim-pulse" />
                <span className="text-[8.5px] font-semibold text-brand uppercase tracking-[0.1em]">
                  Live
                </span>
              </div>
            </div>

            {/* Forgotten badge — more refined: smaller, no emoji */}
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-amber-50 ring-1 ring-amber-200/70 px-2 py-0.5 text-[9.5px] font-semibold text-amber-900">
              <span className="w-1 h-1 rounded-full bg-amber-600" aria-hidden />
              2 forgotten · $46.99/mo
            </div>
          </div>

          {/* Subscription rows — real brand SVG marks (simple-icons,
              CC0 licensed). Each logo is the actual brand mark in the
              official brand color. The "unknown" row uses a question-
              mark glyph because Paddle.net is fictional in this mock
              and the visual story is "we detected something we don't
              recognize." */}
          <div className="px-3 pt-2 space-y-1.5 flex-1 overflow-hidden">
            <SubRow brand="netflix" name="Netflix" detail="Streaming" amount="$22.99" />
            <SubRow brand="spotify" name="Spotify" detail="Music" amount="$11.99" />
            <SubRow
              brand="adobe"
              name="Adobe CC"
              detail="Trial → $59.99 Fri"
              amount="$22.99"
              flagged
            />
            <SubRow brand="amazon" name="Amazon" detail="Prime annual" amount="$14.99" />
            <SubRow
              brand="unknown"
              name="Paddle.net"
              detail="Unknown merchant"
              amount="$24.00"
              flagged
            />
          </div>

          {/* Tab bar mockup — refined: light backdrop, slightly raised
              active state, no decorative dot above label */}
          <div className="border-t border-hairline/60 bg-white/70 backdrop-blur-sm">
            <div className="px-5 py-2 flex items-center justify-around">
              <TabIcon active label="Home" />
              <TabIcon label="Calendar" />
              <TabIcon label="Alerts" />
              <TabIcon label="Settings" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubRow({
  brand,
  name,
  detail,
  amount,
  flagged,
}: {
  brand: BrandKey;
  name: string;
  detail: string;
  amount: string;
  flagged?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center gap-2 rounded-lg px-2 py-1.5 border transition " +
        (flagged
          ? "border-amber-200 bg-amber-50/60"
          : "border-hairline/50 bg-white")
      }
    >
      <BrandLogo brand={brand} size={22} rounded="md" />
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-semibold text-ink truncate">
          {name}
        </div>
        <div className="text-[8.5px] text-ink-body/85 truncate">{detail}</div>
      </div>
      <div className="text-[10px] font-semibold text-ink tnum shrink-0">
        {amount}
      </div>
    </div>
  );
}

function TabIcon({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        aria-hidden="true"
        className={
          "w-4 h-4 rounded " +
          (active ? "bg-brand/15 ring-1 ring-brand/40" : "bg-ink/10")
        }
      />
      <span
        className={
          "text-[7.5px] tracking-[0.04em] " +
          (active ? "text-brand font-semibold" : "text-ink-body/70")
        }
      >
        {label}
      </span>
    </div>
  );
}
