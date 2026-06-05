// Static "Frugavo noticed" feed mockup — feature-spotlight visual for
// the "Get alerted when something changes" section. Phase G (2026-06-05).
//
// Shows a chronological feed of background observations Frugavo's
// monitoring engine surfaces. Mirrors the in-app /app/noticed feed
// but with curated mock entries that highlight the kind of value
// only continuous monitoring delivers.

"use client";

import { motion } from "framer-motion";
import { Bell, DollarSign, Eye, Plus, TrendingUp } from "lucide-react";
import { BrandLogo, type BrandKey } from "@/components/marketing/brand-logo";

// Stagger entrance for feed items — slide-up + fade. Trips on
// scroll-into-view via the parent figure's variants.
const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.2 + i * 0.1,
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

type FeedItem = {
  id: string;
  kind: "price_up" | "trial_convert" | "new_charge" | "unused";
  brand: string;
  brandKey: BrandKey;
  detail: string;
  meta: string;
  pillTone: "amber" | "red" | "blue" | "slate";
  Icon: typeof Bell;
};

const FEED: FeedItem[] = [
  {
    id: "1",
    kind: "trial_convert",
    brand: "Adobe Creative Cloud",
    brandKey: "adobe",
    detail: "Free trial converts to $59.99/mo this Friday",
    meta: "2 days from now",
    pillTone: "amber",
    Icon: Bell,
  },
  {
    id: "2",
    kind: "price_up",
    brand: "Netflix",
    brandKey: "netflix",
    detail: "Monthly price increased from $15.49 → $17.99",
    meta: "3 days ago",
    pillTone: "red",
    Icon: TrendingUp,
  },
  {
    id: "3",
    kind: "new_charge",
    brand: "Unknown merchant",
    brandKey: "unknown",
    detail: "New recurring charge of $19.00/mo from Paddle.net",
    meta: "5 days ago",
    pillTone: "blue",
    Icon: Plus,
  },
  {
    id: "4",
    kind: "unused",
    brand: "Audible",
    brandKey: "audible",
    detail: "Unused for 4 months — still billing $14.95/mo",
    meta: "1 week ago",
    pillTone: "slate",
    Icon: Eye,
  },
];

const PILL_TONE_CLASS: Record<FeedItem["pillTone"], string> = {
  amber: "bg-amber-100 text-amber-900",
  red:   "bg-red-100 text-red-900",
  blue:  "bg-blue-100 text-blue-900",
  slate: "bg-slate-100 text-slate-700",
};

export function NoticedFeedMockup() {
  return (
    <motion.figure
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="rounded-3xl border border-hairline bg-white shadow-[0_24px_60px_-30px_rgba(10,10,10,0.18)] overflow-hidden max-w-[440px] mx-auto"
      aria-label="Sample Frugavo Noticed feed — four background observations."
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-hairline/60 flex items-center justify-between">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-body">
            Frugavo noticed
          </div>
          <div className="mt-1 font-display text-[20px] font-bold tracking-[-0.015em] text-ink leading-none">
            4 new this week
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2 h-6 text-[10.5px] font-semibold text-brand">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          Live
        </div>
      </div>

      {/* Feed list */}
      <ul className="p-3 space-y-2">
        {FEED.map((item, i) => (
          <motion.li
            key={item.id}
            variants={ITEM_VARIANTS}
            custom={i}
            className="rounded-xl border border-hairline/70 bg-white p-3 hover:border-hairline transition"
          >
            <div className="flex items-start gap-2.5">
              <BrandLogo brand={item.brandKey} size={32} rounded="lg" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12.5px] font-semibold text-ink truncate">
                    {item.brand}
                  </span>
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] " +
                      PILL_TONE_CLASS[item.pillTone]
                    }
                  >
                    <item.Icon size={9} strokeWidth={2.5} aria-hidden />
                    {item.kind === "price_up" && "Price up"}
                    {item.kind === "trial_convert" && "Trial ending"}
                    {item.kind === "new_charge" && "New"}
                    {item.kind === "unused" && "Unused"}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-ink-body leading-relaxed">
                  {item.detail}
                </p>
                <p className="mt-1 text-[10.5px] text-ink-body/70">
                  {item.meta}
                </p>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>

      <figcaption className="px-5 py-2.5 bg-ink/[0.02] text-[10.5px] text-ink-body/80 text-center border-t border-hairline/60">
        Sample observations · mock data
      </figcaption>
    </motion.figure>
  );
}

// Tiny inline DollarSign re-export keeps tree-shaking happy in the
// rare case a future feed-item wants a price-related icon.
export { DollarSign };
