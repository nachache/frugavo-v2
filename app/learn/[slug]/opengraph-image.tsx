import { ImageResponse } from "next/og";
import { getArticle, CLUSTER_LABEL } from "@/lib/learn";

// Dynamic 1200x630 OG image per article. No copyrighted logos, no third-party
// brand marks — only Frugavo branding plus the article title/cluster. Safe
// for Meta and Google Ads use.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage({ params }: { params: { slug: string } }) {
  const article = getArticle(params.slug);
  const title = article?.title ?? "The Frugavo Library";
  const cluster = article ? CLUSTER_LABEL[article.cluster] : "Reference";

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
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#047857",
            }}
          />
          <span style={{ fontSize: 28, fontWeight: 700, color: "#0A0A0A", letterSpacing: -1 }}>
            frugavo
          </span>
          <span
            style={{
              marginLeft: 16,
              fontSize: 16,
              color: "#737373",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            · {cluster}
          </span>
        </div>

        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#0A0A0A",
            letterSpacing: -2.5,
            lineHeight: 1.05,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 20, color: "#404040" }}>
            The Frugavo Library · frugavo.com/learn
          </span>
          <span
            style={{
              fontSize: 16,
              color: "#047857",
              padding: "8px 16px",
              borderRadius: 999,
              background: "#ECFDF5",
            }}
          >
            Reference
          </span>
        </div>
      </div>
    ),
    size
  );
}
