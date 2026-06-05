// Shared brand logo component for landing-page mockups.
//
// Powered by logo.dev — they resolve any company domain to a clean
// brand logo with a monogram fallback when the brand isn't in their
// index. Used across the hero phone, noticed feed, calendar, alert
// detail, and cancel-assist mockups.
//
// Why logo.dev:
//   • Works for ANY domain (not just an indexed list)
//   • Returns clean PNG/SVG, not flat silhouette paths
//   • Built-in monogram fallback so we never show a broken image
//   • Free for public/demo use with the publishable token below
//
// If logo.dev's free token ever gets revoked, the next move is to
// download the ~10 SVGs we actually use into /public/logos/ and
// reference them statically. Documented as a follow-up — for now,
// the CDN is the right balance of canonical-quality and zero ops.

import type { CSSProperties } from "react";

// logo.dev's public/demo publishable key. Swap for your own from
// https://logo.dev once you sign up for a free account if you want
// per-account analytics and higher rate limits.
const LOGO_DEV_TOKEN = "pk_X-1ZO13GSgeOoUrIuJ6GMQ";

type BrandKey =
  | "netflix"
  | "spotify"
  | "adobe"
  | "amazon"
  | "microsoft"
  | "apple"
  | "audible"
  | "paddle"
  | "hellofresh"
  | "unknown";

// Map a friendly brand key to the canonical domain. Domain is what
// logo.dev uses to resolve the actual logo.
const BRAND_DOMAIN: Record<BrandKey, string | null> = {
  netflix:    "netflix.com",
  spotify:    "spotify.com",
  adobe:      "adobe.com",
  amazon:     "amazon.com",
  microsoft:  "microsoft.com",
  apple:      "apple.com",
  audible:    "audible.com",
  paddle:     "paddle.com",
  hellofresh: "hellofresh.com",
  unknown:    null,
};

type BrandLogoProps = {
  brand: BrandKey;
  size?: number;
  rounded?: "md" | "lg" | "xl";
  bg?: string;
  className?: string;
  style?: CSSProperties;
};

export function BrandLogo({
  brand,
  size = 24,
  rounded = "md",
  bg = "#FFFFFF",
  className = "",
  style,
}: BrandLogoProps) {
  const domain = BRAND_DOMAIN[brand];
  const roundClass =
    rounded === "xl" ? "rounded-xl" : rounded === "lg" ? "rounded-lg" : "rounded-md";

  // Unknown merchant → plain "?" glyph in a neutral tile. We
  // deliberately don't try to render a logo here because the row
  // exists to demonstrate the "we found something we can't identify"
  // story.
  if (!domain) {
    return (
      <span
        aria-hidden="true"
        className={`${roundClass} flex items-center justify-center shrink-0 ring-1 ring-hairline text-ink-body ${className}`}
        style={{
          width: size,
          height: size,
          background: "#F5F5F5",
          ...style,
        }}
      >
        <span
          className="font-bold leading-none"
          style={{ fontSize: Math.round(size * 0.5) }}
        >
          ?
        </span>
      </span>
    );
  }

  // logo.dev URL params:
  //   token        — required public key
  //   size         — pixel width (logo.dev returns a square)
  //   format       — png is widest-compat; webp/svg also supported
  //   fallback=monogram — auto monogram if the brand isn't indexed
  //   retina=true  — request the 2x asset for crisp rendering on HiDPI
  const src = `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=${
    size * 2
  }&format=png&fallback=monogram&retina=true`;

  return (
    <span
      aria-hidden="true"
      className={`${roundClass} flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-ink/[0.05] ${className}`}
      style={{ width: size, height: size, background: bg, ...style }}
    >
      {/* Plain <img> here (not next/image):
          - source is an external CDN we can't statically optimize
          - sizes are tiny (≤48px) so optimizer overhead would
            outweigh the savings */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </span>
  );
}

export type { BrandKey };
