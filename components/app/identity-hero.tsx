// IdentityHero — first card on the dashboard.
//
// Personality is THE thing the user comes back for. Restored from the
// pre-refactor design at the top of the page, but cleaner: identity
// card SVG preview on the left, personality label + sub + social-
// logo share buttons (image, not link) on the right.
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
};

function fmt(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

export function IdentityHero({
  monthlySubCents,
  personality,
  publicSlug,
}: Props) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 md:p-7 animate-fadeUp overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-7 items-center">
        {/* Identity card preview — capped on mobile so the 9:16 SVG
            doesn't blow out the viewport. ~240px wide on phone, full
            column on desktop. */}
        <a
          href="/api/share-card/identity"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl overflow-hidden border border-hairline bg-ink transition hover:opacity-95 mx-auto md:mx-0 max-w-[240px] md:max-w-none w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/share-card/identity"
            alt="Your subscription identity card"
            className="w-full h-auto block"
            loading="eager"
          />
        </a>

        {/* Personality + share controls */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              Your subscription personality
            </div>
            <div className="mt-2 font-display text-[28px] md:text-[36px] font-bold tracking-[-0.02em] text-ink leading-tight">
              {personality.label}
            </div>
            <div className="mt-2 text-[14px] md:text-[15px] text-ink-body leading-relaxed">
              {personality.sub}
            </div>
          </div>

          <div>
            <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-2">
              Share your numbers
            </div>
            <ShareButtons
              shareType="identity"
              shareText={`I'm "${personality.label}" — ${fmt(monthlySubCents)}/mo on recurring charges.`}
              shareSlug={publicSlug ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
