import { ImageResponse } from "next/og";

// Root OG image — what social platforms render when frugavo.com is
// shared. 1200×630 is the universal "large image card" size for
// Twitter, LinkedIn, iMessage, Slack, and Facebook.
//
// Edge runtime so the response is fast (no cold start) and the asset
// can be cached at the CDN. ImageResponse is Next.js's wrapper around
// Satori — uses inline JSX + style objects (no Tailwind, no CSS files).
//
// Same visual language as the learn OG image: canvas background,
// brand dot, the same Inter typeface, dollar-sign accent for the
// money-watching motif.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#FAF8F4",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Brand strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#047857",
            }}
          />
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#0A0A0A",
              letterSpacing: -1,
            }}
          >
            frugavo
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: "#0A0A0A",
            letterSpacing: -4,
            lineHeight: 0.98,
          }}
        >
          Your subscription
          <br />
          <span style={{ color: "#047857" }}>protection intelligence.</span>
        </div>

        {/* Subhead */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <span
            style={{
              fontSize: 28,
              color: "#404040",
              lineHeight: 1.3,
              maxWidth: 880,
            }}
          >
            Frugavo quietly observes every recurring charge across your
            accounts and surfaces what changes — before you notice.
          </span>
          <span
            style={{
              fontSize: 22,
              color: "#737373",
              letterSpacing: -0.3,
            }}
          >
            frugavo.com · Founder Access during early access
          </span>
        </div>
      </div>
    ),
    size
  );
}
