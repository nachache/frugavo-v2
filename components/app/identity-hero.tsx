// IdentityHero — first card on the dashboard.
//
// Layout: vertical stack (image at top, personality + sub in the
// middle, share buttons at the bottom). The vertical layout lets
// the parent page place IdentityHero next to a sibling
// Protection rail on desktop without each fighting for horizontal
// real estate.
//
// Server component — embeds the client <ShareButtons /> for the
// actual sharing primitives.

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
        <div className="mt-1.5 font-display text-[28px] sm:text-[32px] md:text-[38px] font-bold tracking-[-0.02em] text-ink leading-[1.08]">
          you&apos;re the
          <br />
          <span className="text-brand">{personality.label}</span>.
        </div>
        <div className="mt-3 text-[15px] md:text-[16.5px] text-ink-body leading-relaxed">
          {personality.sub}
        </div>
      </div>

      {/* Share buttons at the bottom */}
      <div className="mt-5 md:mt-6 pt-4 md:pt-5 border-t border-hairline px-1 md:px-2">
        <div className="text-[11.5px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-2.5">
          Share your card
        </div>
        <ShareButtons
          shareType="identity"
          shareText={`I'm "${personality.label}" — ${fmt(monthlySubCents)}/mo on recurring charges.`}
          shareSlug={publicSlug ?? null}
        />
      </div>
    </div>
  );
}
