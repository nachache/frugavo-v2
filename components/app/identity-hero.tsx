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
    <div className="rounded-2xl border border-hairline bg-surface p-4 md:p-6 animate-fadeUp overflow-hidden h-full flex flex-col">
      {/* Identity SVG preview — capped width so a tall card doesn't
          dominate the column on desktop. */}
      <a
        href="/api/share-card/identity"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl overflow-hidden border border-hairline bg-ink transition hover:opacity-95 mx-auto w-full max-w-[280px] md:max-w-[320px]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/share-card/identity"
          alt="Your subscription identity card"
          className="w-full h-auto block"
          loading="eager"
        />
      </a>

      {/* Personality label + sub */}
      <div className="mt-5 md:mt-6 text-center md:text-left">
        <div className="text-[12.5px] md:text-[13px] font-medium text-ink-muted">
          {greeting}
        </div>
        <div className="mt-1 font-display text-[26px] sm:text-[30px] md:text-[32px] font-bold tracking-[-0.02em] text-ink leading-[1.08]">
          you&apos;re the
          <br />
          <span className="text-brand">{personality.label}</span>.
        </div>
        <div className="mt-2.5 text-[14.5px] md:text-[15px] text-ink-body leading-relaxed">
          {personality.sub}
        </div>
      </div>

      {/* Share buttons at the bottom */}
      <div className="mt-5 md:mt-6 pt-4 md:pt-5 border-t border-hairline">
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
