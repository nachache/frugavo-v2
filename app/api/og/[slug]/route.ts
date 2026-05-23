import { NextResponse } from "next/server";
import { loadPublicProfile } from "@/lib/users/public-profile";

// GET /api/og/:slug
//
// PUBLIC, unauthenticated. Returns a 1200x630 Open Graph image
// (image/svg+xml) for the user identified by the public slug.
// Referenced by /u/<slug>'s og:image so social platforms scrape
// a personalized preview when the URL is shared.
//
// Privacy: only the same aggregate fields the dashboard hero shows
// (personality label/sub, monthly $, subscription count). No
// merchant names, no categories — anyone with the slug can see
// this preview, so it must be safe to be public by design.

export const runtime = "nodejs";
export const maxDuration = 5;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtUsd(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const profile = await loadPublicProfile(params.slug);

  // Render a fallback "Frugavo" card if the slug doesn't resolve.
  // Returning 404 here would mean broken share previews for users
  // mid-onboarding; a generic preview is friendlier.
  const label = profile?.personality_label ?? "Watching your subscriptions";
  const sub =
    profile?.personality_sub ?? "See where your money quietly goes.";
  const burn = fmtUsd(profile?.monthly_burn_cents ?? 0);
  const subCount = profile?.subscription_count ?? 0;

  const W = 1200;
  const H = 630;
  const ACCENT = "#10b981";

  // Personality label can be long ("The Productivity Maximalist") —
  // auto-shrink so it fits the 1-line treatment.
  const labelLen = label.length;
  const labelFontSize =
    labelLen >= 28 ? 56 : labelLen >= 22 ? 68 : labelLen >= 16 ? 80 : 92;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#171717"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="22%" r="60%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"/>

  <!-- Brand row -->
  <g transform="translate(60, 60)">
    <circle cx="16" cy="16" r="16" fill="${ACCENT}"/>
    <text x="48" y="26" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="30" font-weight="600" fill="#f5f5f5" letter-spacing="-0.3">Frugavo</text>
  </g>

  <!-- Eyebrow -->
  <text x="60" y="240" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="22" font-weight="500" fill="#737373" letter-spacing="2"
        text-transform="uppercase">SUBSCRIPTION PERSONALITY</text>

  <!-- Personality label -->
  <text x="60" y="320" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="${labelFontSize}" font-weight="700" fill="#fafafa" letter-spacing="-2">${escapeXml(label)}</text>

  <!-- Sub -->
  <text x="60" y="380" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="24" font-weight="400" fill="#a3a3a3" letter-spacing="-0.3">${escapeXml(sub)}</text>

  <!-- Stats row -->
  <g transform="translate(60, 460)">
    <text x="0" y="0" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="18" font-weight="500" fill="#737373" letter-spacing="1.5"
          text-transform="uppercase">MONTHLY BURN</text>
    <text x="0" y="56" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="56" font-weight="700" fill="${ACCENT}" letter-spacing="-2"
          font-variant-numeric="tabular-nums">${escapeXml(burn)}</text>

    <text x="380" y="0" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="18" font-weight="500" fill="#737373" letter-spacing="1.5"
          text-transform="uppercase">RECURRING</text>
    <text x="380" y="56" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-size="56" font-weight="700" fill="#fafafa" letter-spacing="-2"
          font-variant-numeric="tabular-nums">${subCount}</text>
  </g>

  <!-- Footer -->
  <text x="60" y="580" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="20" font-weight="500" fill="#737373" letter-spacing="-0.2">frugavo.com</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Public route, content is opaque to viewer. Aggressive cache
      // is fine — when a user's data changes, the slug stays the
      // same but the social platforms re-scrape periodically.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
