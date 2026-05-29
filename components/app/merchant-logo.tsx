"use client";

// MerchantLogo — multi-source logo with a reliability cascade.
//
// Why three sources, in this order:
//
//   1. DuckDuckGo ip3 favicon proxy
//      https://icons.duckduckgo.com/ip3/{domain}.ico
//      — Indexes essentially every site on the public web; serves a
//        crisp transparent-background icon for the vast majority.
//        No auth, no rate limit visible. This is the highest-hit-rate
//        source available without an API key.
//
//   2. Google s2 favicons @128px
//      https://www.google.com/s2/favicons?domain={domain}&sz=128
//      — Backup when DDG returns a tiny placeholder or 200-with-empty.
//        Always returns SOMETHING for any domain Google has crawled
//        (which is essentially everything).
//
//   3. Clearbit Logo API
//      https://logo.clearbit.com/{domain}
//      — Highest QUALITY when it hits, but HubSpot deprecated the
//        free tier in 2024 and coverage shrinks over time. Kept as
//        a last network try because for major brands (Netflix,
//        Spotify, Adobe…) the result is a tightly-cropped brand
//        logo, not a tiny favicon.
//
//   4. Colored monogram — no network, always works.
//
// Quality detection:
//   Even when sources return HTTP 200, they may serve a 1x1 transparent
//   pixel or a generic globe placeholder. We use the loaded image's
//   naturalWidth to detect that and bump to the next source.
//
//   Threshold: anything < 12px natural width is treated as "not a
//   real logo." DDG sometimes returns 16x16, which still passes.
//
// Browser cache:
//   Each source returns cache-control headers, so once a row loads,
//   any subsequent row referencing the same merchant_key uses the
//   memory cache. No de-duplication needed at the component level.

import { useState } from "react";

type Props = {
  name: string;
  domain?: string | null;
  size?: number;
  rounded?: "md" | "lg" | "full";
};

const PALETTE = [
  ["#FEE2E2", "#7F1D1D"],
  ["#FED7AA", "#7C2D12"],
  ["#FEF3C7", "#78350F"],
  ["#D1FAE5", "#064E3B"],
  ["#CFFAFE", "#155E75"],
  ["#DBEAFE", "#1E3A8A"],
  ["#E0E7FF", "#3730A3"],
  ["#EDE9FE", "#4C1D95"],
  ["#FCE7F3", "#831843"],
];

// Minimum natural width we accept as a "real" logo. DDG sometimes
// returns 16x16 favicons which is fine; placeholders are usually 1×1
// or 8×8.
const MIN_NATURAL_WIDTH = 12;

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

function initialsOf(name: string): string {
  const cleaned = name.replace(/[^a-z0-9 ]/gi, " ").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return (
    parts.map((p) => p[0]?.toUpperCase() ?? "").join("") ||
    cleaned[0]!.toUpperCase()
  );
}

// Normalize a domain so all three sources see the same thing.
// Strips a leading "www." (some catalog entries include it, some
// don't) and forces lowercase.
function normalizeDomain(d: string): string {
  return d.trim().toLowerCase().replace(/^www\./, "");
}

function sourcesFor(domain: string): string[] {
  const d = normalizeDomain(domain);
  return [
    // 1 — DuckDuckGo: highest hit rate.
    `https://icons.duckduckgo.com/ip3/${d}.ico`,
    // 2 — Google: ubiquitous fallback.
    `https://www.google.com/s2/favicons?domain=${d}&sz=128`,
    // 3 — Clearbit: highest quality when it lands.
    `https://logo.clearbit.com/${d}`,
  ];
}

export function MerchantLogo({
  name,
  domain,
  size = 32,
  rounded = "md",
}: Props) {
  const [srcIdx, setSrcIdx] = useState(0);
  const radius =
    rounded === "full" ? "9999px" : rounded === "lg" ? "10px" : "6px";

  const sources = domain ? sourcesFor(domain) : [];
  const exhausted = srcIdx >= sources.length;

  // No domain OR every source rejected → monogram fallback.
  if (!domain || exhausted) {
    const [bg, fg] = PALETTE[hashIndex(name, PALETTE.length)];
    const initials = initialsOf(name);
    const fontSize = Math.max(10, Math.round(size * 0.42));
    return (
      <span
        aria-label={name}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: radius,
          background: bg,
          color: fg,
          fontWeight: 700,
          fontSize,
          lineHeight: 1,
          userSelect: "none",
          flexShrink: 0,
          border: "1px solid rgba(10,10,10,0.04)",
        }}
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={srcIdx}
      src={sources[srcIdx]}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={(e) => {
        // Some sources return a 200 with a 1×1 placeholder when they
        // don't have the logo. naturalWidth tells us whether what we
        // got is real. If it's below the threshold, bump to the next
        // source — exactly the same path onError takes.
        const img = e.currentTarget as HTMLImageElement;
        if (img.naturalWidth > 0 && img.naturalWidth < MIN_NATURAL_WIDTH) {
          setSrcIdx((i) => i + 1);
        }
      }}
      onError={() => setSrcIdx((i) => i + 1)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        objectFit: "contain",
        background: "#ffffff",
        border: "1px solid rgba(10,10,10,0.06)",
        flexShrink: 0,
      }}
    />
  );
}
