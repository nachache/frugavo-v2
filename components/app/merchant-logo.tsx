"use client";

// MerchantLogo — multi-source logo with graceful fallback.
//
// Resolution chain:
//   1. Clearbit Logo API   logo.clearbit.com/{domain}
//   2. Google Favicon S2   www.google.com/s2/favicons?domain={domain}&sz=128
//   3. Colored monogram    last-resort fallback (no network)
//
// Why two network sources: Clearbit is great when it knows the brand
// (Netflix, Spotify, etc.) but 404s for tens of thousands of long-
// tail merchants. Google's favicon service indexes essentially every
// site on the web and never 404s — the icons are smaller but always
// present. Chaining gives us "best-available" coverage.
//
// Each `onError` bumps an index and re-renders with the next source.
// The browser HTTP cache picks up repeated hits to the same merchant
// across rows.

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

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

function initialsOf(name: string): string {
  const cleaned = name.replace(/[^a-z0-9 ]/gi, " ").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || cleaned[0]!.toUpperCase();
}

function sourcesFor(domain: string): string[] {
  return [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
}

export function MerchantLogo({ name, domain, size = 32, rounded = "md" }: Props) {
  const [srcIdx, setSrcIdx] = useState(0);
  const radius =
    rounded === "full" ? "9999px" : rounded === "lg" ? "10px" : "6px";

  const sources = domain ? sourcesFor(domain) : [];
  const exhausted = srcIdx >= sources.length;

  // Fall through to monogram when no domain OR every source errored.
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
