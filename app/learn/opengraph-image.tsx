import { ImageResponse } from "next/og";

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 16, height: 16, borderRadius: 999, background: "#047857" }} />
          <span style={{ fontSize: 28, fontWeight: 700, color: "#0A0A0A", letterSpacing: -1 }}>
            frugavo
          </span>
        </div>

        <div
          style={{
            fontSize: 88,
            fontWeight: 700,
            color: "#0A0A0A",
            letterSpacing: -3.5,
            lineHeight: 1,
          }}
        >
          The Library.
          <br />A reference on the
          <br />
          subscription economy.
        </div>

        <span style={{ fontSize: 22, color: "#404040" }}>
          Creep, dark patterns, behavior, value · frugavo.com/learn
        </span>
      </div>
    ),
    size
  );
}
