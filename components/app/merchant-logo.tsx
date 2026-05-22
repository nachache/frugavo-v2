"use client";

// MerchantLogo — always renders a recognizable mark for a merchant.
//
// Resolution chain (per IA refactor v2 #6):
//   1. Clearbit Logo API: https://logo.clearbit.com/{domain}
//      Free, CDN-backed, no auth. Browser caches the response.
//   2. Falls back to a colored monogram when:
//      - no domain known for this merchant, OR
//      - Clearbit returns 404 / network errors (img.onerror)
//
// We deliberately skip a server-side cache for now. The browser HTTP
// cache + Clearbit's CDN already give us fast repeats, and the
// fallback path means a Clearbit outage is invisible to the user.

import { useState } from "react";

type Props = {
  name: string;
  domain?: string | null;
  size?: number;
  rounded?: "md" | "lg" | "full";
};

const PALETTE = [
  ["#FEE2E2", "#7F1D1D"], // red
  ["#FED7AA", "#7C2D12"], // orange
  ["#FEF3C7", "#78350F"], // amber
  ["#D1FAE5", "#064E3B"], // emerald
  ["#CFFAFE", "#155E75"], // cyan
  ["#DBEAFE", "#1E3A8A"], // blue
  ["#E0E7FF", "#3730A3"], // indigo
  ["#EDE9FE", "#4C1D95"], // violet
  ["#FCE7F3", "#831843"], // pink
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
  return parts
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || cleaned[0]!.toUpperCase();
}

export function MerchantLogo({
  name,
  domain,
  size = 32,
  rounded = "md",
}: Props) {
  const [errored, setErrored] = useState(false);

  const radius =
    rounded === "full" ? "9999px" : rounded === "lg" ? "10px" : "6px";

  // Try Clearbit first.
  if (domain && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://logo.clearbit.com/${encodeURIComponent(domain)}`}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "contain",
          background: "#ffffff",
          border: "1px solid rgba(10,10,10,0.06)",
        }}
      />
    );
  }

  // Monogram fallback.
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
