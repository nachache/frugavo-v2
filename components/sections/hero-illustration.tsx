"use client";

import { ArrowDownRight, Bell, ShieldCheck } from "lucide-react";

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
    <div className="relative mx-auto hero-anim-float" style={{ width: 300 }}>
      {/* Phone outer frame — soft inner gradient + tighter shadow
          stack so it reads as a physical object, not a flat sticker.
          Aspect ratio shortened from 9/19 → 9/14 (2026-06-05). The
          full 9/19 iPhone height was making the hero column read too
          tall; 9/14 shows the meaningful UI (header + subscription
          rows + tab bar) without the dead bottom space. */}
      <div
        className="relative rounded-[36px] shadow-[0_40px_90px_-24px_rgba(10,10,10,0.45),0_8px_22px_-6px_rgba(10,10,10,0.18)] p-2.5"
        style={{
          aspectRatio: "9 / 14",
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

type BrandKey = "netflix" | "spotify" | "adobe" | "amazon" | "unknown";

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
      <BrandLogo brand={brand} />
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

// Brand logo helper — real SVG marks from simple-icons (CC0
// licensed, https://simpleicons.org). Each rendered in the brand's
// official color on a neutral background tile so the marks read as
// recognizable badges. "Unknown" is a question-mark glyph for the
// fictional unknown-merchant row, signaling exactly what Frugavo
// flagged: a charge we can't attribute to a known brand.
const BRAND_SVG: Record<BrandKey, { color: string; bg: string; path: string }> = {
  netflix: {
    color: "#E50914",
    bg: "#FFFFFF",
    path: "M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24zm8.489 0v9.63L18.6 22.951c-.043-7.86-.004-15.913.002-22.95H13.89zm-8.487 0H.001v23.74c1.815-.275 2.96-.469 4.81-.638l-.42-1.187z",
  },
  spotify: {
    color: "#1DB954",
    bg: "#FFFFFF",
    path: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.561.3z",
  },
  adobe: {
    color: "#FA0F00",
    bg: "#FFFFFF",
    path: "M13.966 22.624l-1.69-4.281H8.122l3.892-9.144 5.662 13.425zM8.884 1.376H0v21.248zm15.116 0h-8.884L24 22.624Z",
  },
  amazon: {
    color: "#FF9900",
    bg: "#0F1111",
    path: "M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.525.13.12.174.09.336-.12.48-.256.19-.6.41-1.006.654-1.244.743-2.64 1.316-4.185 1.726a17.617 17.617 0 01-4.83.615c-2.83 0-5.524-.49-8.082-1.46-2.555-.972-4.825-2.345-6.81-4.12-.063-.039-.103-.111-.103-.184a.196.196 0 01.045-.12zm6.265-6.45c0-1.024.255-1.901.764-2.628.51-.727 1.205-1.273 2.092-1.638.81-.336 1.821-.575 3.038-.72.413-.046 1.087-.103 2.022-.174V6.06c0-.745-.083-1.247-.244-1.508-.246-.357-.633-.534-1.165-.534h-.144c-.39.029-.722.144-1.014.349-.286.21-.471.5-.55.873-.05.236-.169.371-.36.404l-2.082-.255c-.207-.046-.31-.156-.31-.331 0-.034.005-.07.014-.105.207-1.082.715-1.886 1.534-2.413.81-.527 1.766-.812 2.851-.853h.45c1.386 0 2.467.357 3.247 1.075.117.119.224.246.32.38.097.135.176.255.236.36.06.106.106.255.143.45.038.193.063.32.085.382.022.061.038.214.05.46.013.244.02.39.02.434v4.108c0 .291.04.557.13.798.084.243.166.412.247.51l.41.55c.075.105.111.198.111.282 0 .093-.045.171-.139.235-1.034.9-1.6 1.387-1.694 1.464-.16.116-.351.124-.575.026-.193-.165-.36-.32-.503-.466l-.405-.46c-.034-.041-.078-.103-.13-.184a.59.59 0 01-.034-.184c-.011-.041-.025-.083-.04-.124-.345.481-.66.78-.965 1.005-.622.401-1.327.602-2.115.602-.967 0-1.766-.297-2.396-.892-.63-.594-.945-1.443-.945-2.546zm3.42-.397c0 .495.124.892.37 1.19.247.297.586.446 1.016.446.04 0 .096-.005.17-.014a.732.732 0 01.155-.014c.541-.144.957-.5 1.246-1.069.142-.255.245-.534.318-.834.07-.301.105-.55.115-.749.01-.198.013-.519.013-.964v-.524c-.882 0-1.555.064-2.014.193-1.318.376-1.974 1.106-1.974 2.34zm12.4 8.198a4.36 4.36 0 00.165-.42c.058-.193.025-.252-.1-.281a3.59 3.59 0 00-1.55-.158c-.193.023-.398.07-.611.144-.215.07-.412.16-.59.27-.18.108-.32.211-.42.31-.1.097-.166.176-.21.224a.124.124 0 00-.05.137c.014.057.044.097.087.124.182.083.395.105.61.067.215-.039.453-.105.713-.205l.27-.114c.092-.04.193-.084.295-.13a3.86 3.86 0 00.39-.224c.044-.034.067-.082.067-.143z",
  },
  unknown: {
    // Placeholder for the fictional Paddle.net unknown-merchant row.
    // Not a real brand mark — intentionally a generic glyph that
    // communicates "we detected a charge from somewhere we can't
    // attribute." Tied to the "Forgotten" flag visual treatment.
    color: "#737373",
    bg: "#F5F5F5",
    path: "",
  },
};

function BrandLogo({ brand }: { brand: BrandKey }) {
  const cfg = BRAND_SVG[brand];
  if (brand === "unknown") {
    return (
      <span
        aria-hidden="true"
        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 ring-1 ring-hairline"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        <span className="text-[12px] font-bold leading-none">?</span>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 ring-1 ring-ink/[0.04]"
      style={{ background: cfg.bg }}
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill={cfg.color}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={cfg.path} />
      </svg>
    </span>
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
