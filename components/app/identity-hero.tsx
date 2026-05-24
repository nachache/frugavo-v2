// IdentityHero — first card on the dashboard.
//
// Layout: vertical stack (image at top, personality + sub in the
// middle, share toggle at the bottom). The 5-social-icon row used
// to live inline; per dashboard critic it read like "CTA shotgun."
// Now it's a single 'Share' button that expands to the full picker
// on click — same primitives, less visual noise.

"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareButtons } from "./share-buttons";
import type { Personality } from "@/lib/personality";

type Props = {
  monthlySubCents: number;
  personality: Personality;
  // Public profile slug. When present, ShareButtons attaches the
  // canonical /u/<slug> URL to navigator.share so social platforms
  // unfurl the right personalized OG preview. May be null on the
  // very first dashboard render before the slug is provisioned.
  publicSlug?: string | null;
  // First name from Clerk for warmer mobile framing ("Hey Nabil —
  // you're the Wellness Devotee."). Falls back to a generic
  // greeting when null.
  firstName?: string | null;
};

function fmt(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

export function IdentityHero({
  monthlySubCents,
  personality,
  publicSlug,
  firstName,
}: Props) {
  const greeting = firstName ? `Hey ${firstName} —` : "Here's your card —";
  const [shareOpen, setShareOpen] = useState(false);

  return (
    // Reduced outer padding (was p-4 md:p-6 → p-3 md:p-4) and removed
    // the card's max-width cap. The SVG card now fills its column so
    // the SVG fonts inside aren't shrunk into illegibility on desktop.
    <div className="rounded-2xl border border-hairline bg-surface p-3 md:p-4 animate-fadeUp overflow-hidden h-full flex flex-col">
      {/* Identity SVG preview — full width of the column for desktop
          readability. The card still maintains its aspect ratio so it
          looks the same at any width. */}
      <a
        href="/api/share-card/identity"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl overflow-hidden border border-hairline bg-ink transition hover:opacity-95 w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/share-card/identity"
          alt="Your subscription identity card"
          className="w-full h-auto block"
          loading="eager"
        />
      </a>

      {/* Personality label + sub. Slightly bigger headlines on
          desktop so the card and the prose feel balanced. */}
      <div className="mt-5 md:mt-7 text-center md:text-left px-1 md:px-2">
        <div className="text-[13px] md:text-[14px] font-medium text-ink-muted">
          {greeting}
        </div>
        {/* Personality labels already lead with "The " (e.g. "The
            Streaming Collector"). Previously we wrote "you're the"
            ahead of the span which produced "you're the The …" —
            critic flagged the double article. Drop the leading
            "you're the" and let the label stand on its own. */}
        <div className="mt-1.5 font-display text-[28px] sm:text-[32px] md:text-[38px] font-bold tracking-[-0.02em] text-ink leading-[1.08]">
          You&apos;re
          <br />
          <span className="text-brand">{personality.label}</span>.
        </div>
        <div className="mt-3 text-[15px] md:text-[16.5px] text-ink-body leading-relaxed">
          {personality.sub}
        </div>
      </div>

      {/* Share — single button, expands to the picker on click.
          Wrapped in a soft canvas panel so it reads as a dedicated
          "share affordance" instead of a naked button sitting
          under the prose. Was bare; critic said the button looked
          like a label. The bg-canvas/40 wrapper gives it a clear
          home without competing with the personality copy. */}
      <div className="mt-5 md:mt-6">
        <div className="rounded-2xl bg-canvas/50 border border-hairline/60 px-4 py-3 md:px-5 md:py-4">
          {shareOpen ? (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[11.5px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                  Share your card
                </div>
                <button
                  type="button"
                  onClick={() => setShareOpen(false)}
                  className="text-[11.5px] text-ink-muted hover:text-ink transition"
                  aria-label="Close share options"
                >
                  Done
                </button>
              </div>
              <ShareButtons
                shareType="identity"
                shareText={`I'm "${personality.label}" — ${fmt(monthlySubCents)}/mo on recurring charges.`}
                shareSlug={publicSlug ?? null}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink text-canvas text-[13px] font-medium hover:bg-ink/85 transition w-full justify-center md:w-auto"
            >
              <Share2 size={14} strokeWidth={2.2} aria-hidden="true" />
              Share your card
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
