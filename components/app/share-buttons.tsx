"use client";

// Share buttons — branded social-logo affordances that share the
// IMAGE, not the website link.
//
// The "X / Facebook / LinkedIn / Instagram" buttons feel like
// platform-specific share targets, but they all converge on the
// same primitive: send the actual PNG of the share card. The
// underlying flow per button:
//
//   1. Convert the share-card SVG → PNG (canvas rasterization,
//      memoized so multiple clicks reuse the same blob).
//   2. Try the native share sheet first via navigator.share with
//      files. On mobile, this opens iOS / Android's system sheet
//      with the PNG attached — the user picks the destination app
//      and the image is what gets posted, not a link.
//   3. On browsers without file-share support (desktop Firefox,
//      some Chromes on Linux), copy the PNG to the system clipboard
//      AND open the platform's web compose URL in a new tab. The
//      user pastes the image. Instagram has no web compose, so for
//      Instagram we only copy + toast "open Instagram and paste".
//
// We keep a "Download" affordance as a final fallback — works
// everywhere, never fails.

import { useCallback, useRef, useState } from "react";

type Props = {
  shareType: string;
  shareText: string;
  compact?: boolean;
  // Public profile slug. When provided, the share payload includes
  // the canonical /u/<slug> URL so social platforms unfurl with
  // the personalized OG preview rather than scraping the homepage.
  shareSlug?: string | null;
};

type Target = "x" | "facebook" | "linkedin" | "instagram";

// Compose URLs that benefit from a URL param to attach a link to
// the user's personalized profile preview. Twitter accepts `url=…`
// which it then unfurls server-side; Facebook + LinkedIn read OG
// tags from whatever URL is shared. Instagram has no compose URL.
function composeUrl(target: Target, text: string, url: string | null): string | null {
  switch (target) {
    case "x":
      return url
        ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
        : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    case "facebook":
      return url
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
        : `https://www.facebook.com/`;
    case "linkedin":
      return url
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
        : `https://www.linkedin.com/feed/?shareActive=true`;
    case "instagram":
      return null;
  }
}

export function ShareButtons({
  shareType,
  shareText,
  compact,
  shareSlug,
}: Props) {
  // Build the canonical share URL on the client. Using
  // window.location.origin lets the same code work locally and in
  // production without an env var, and the slug comes from the
  // server-rendered parent so we never expose anyone else's data.
  const profileUrl =
    typeof window !== "undefined" && shareSlug
      ? `${window.location.origin}/u/${shareSlug}`
      : null;
  const pngBlobRef = useRef<Blob | null>(null);
  const [status, setStatus] = useState<
    null | { kind: "ok" | "err"; msg: string }
  >(null);
  const [busy, setBusy] = useState<Target | "download" | null>(null);

  const flash = useCallback((kind: "ok" | "err", msg: string) => {
    setStatus({ kind, msg });
    setTimeout(() => setStatus(null), 2200);
  }, []);

  const buildPng = useCallback(async (): Promise<Blob> => {
    if (pngBlobRef.current) return pngBlobRef.current;
    const res = await fetch(`/api/share-card/${shareType}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Failed to load card (${res.status})`);
    const svgText = await res.text();
    const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const img = await new Promise<HTMLImageElement>((ok, ng) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = (e) => ng(e);
        i.src = svgUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 1080;
      canvas.height = img.naturalHeight || 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unsupported");
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob>((ok, ng) => {
        canvas.toBlob(
          (b) => (b ? ok(b) : ng(new Error("toBlob failed"))),
          "image/png",
          0.95
        );
      });
      pngBlobRef.current = png;
      return png;
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }, [shareType]);

  const shareTo = useCallback(
    async (target: Target) => {
      setBusy(target);
      try {
        const png = await buildPng();
        const file = new File([png], `frugavo-${shareType}.png`, {
          type: "image/png",
        });

        // Try native share sheet — user picks the target. On mobile
        // this puts the user one tap from posting to whichever app
        // we hint at with the icon they clicked.
        const nav = navigator as Navigator & {
          canShare?: (data: ShareData) => boolean;
        };
        if (nav.canShare && nav.canShare({ files: [file] })) {
          try {
            // Include the canonical profile URL so the receiving app
            // unfurls a personalized OG preview rather than the
            // page URL (which would scrape the dashboard / homepage).
            const sharePayload: ShareData = {
              files: [file],
              title: "Frugavo",
              text: shareText,
            };
            if (profileUrl) sharePayload.url = profileUrl;
            await nav.share(sharePayload);
            flash("ok", "Shared");
            return;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.toLowerCase().includes("abort")) return; // user cancelled
            // fall through to clipboard path
          }
        }

        // Desktop fallback — copy image, open compose URL.
        await copyImageToClipboard(png);
        const compose = composeUrl(target, shareText, profileUrl);
        if (compose) {
          window.open(compose, "_blank", "noopener,noreferrer");
          flash("ok", "Image copied — paste in the new tab");
        } else {
          // Instagram: no compose URL.
          flash("ok", "Image copied — open Instagram to paste");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes("abort")) return;
        flash("err", "Share failed");
      } finally {
        setBusy(null);
      }
    },
    [buildPng, flash, shareText, shareType]
  );

  const downloadImage = useCallback(async () => {
    setBusy("download");
    try {
      const png = await buildPng();
      const url = URL.createObjectURL(png);
      const a = document.createElement("a");
      a.href = url;
      a.download = `frugavo-${shareType}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash("ok", "Downloaded");
    } catch {
      flash("err", "Download failed");
    } finally {
      setBusy(null);
    }
  }, [buildPng, flash, shareType]);

  // On phones the 5-button row + status pill is a tight fit.
  // Default to 36px buttons on mobile, 40px from md up. Compact mode
  // stays 32px universally.
  const sizeCls = compact ? "h-8 w-8" : "h-9 w-9 md:h-10 md:w-10";
  const wrapCls = compact ? "gap-1" : "gap-1.5 md:gap-2";

  return (
    <div className={`flex flex-wrap items-center ${wrapCls}`}>
      <SocialBtn
        target="x"
        label="Share to X"
        busy={busy === "x"}
        disabled={busy !== null}
        onClick={() => shareTo("x")}
        sizeCls={sizeCls}
        bg="bg-ink"
        text="text-canvas"
      >
        <XIcon />
      </SocialBtn>
      <SocialBtn
        target="instagram"
        label="Share to Instagram"
        busy={busy === "instagram"}
        disabled={busy !== null}
        onClick={() => shareTo("instagram")}
        sizeCls={sizeCls}
        // Instagram gradient
        bg="bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]"
        text="text-white"
      >
        <InstagramIcon />
      </SocialBtn>
      <SocialBtn
        target="facebook"
        label="Share to Facebook"
        busy={busy === "facebook"}
        disabled={busy !== null}
        onClick={() => shareTo("facebook")}
        sizeCls={sizeCls}
        bg="bg-[#1877F2]"
        text="text-white"
      >
        <FacebookIcon />
      </SocialBtn>
      <SocialBtn
        target="linkedin"
        label="Share to LinkedIn"
        busy={busy === "linkedin"}
        disabled={busy !== null}
        onClick={() => shareTo("linkedin")}
        sizeCls={sizeCls}
        bg="bg-[#0A66C2]"
        text="text-white"
      >
        <LinkedInIcon />
      </SocialBtn>
      <button
        type="button"
        onClick={downloadImage}
        disabled={busy !== null}
        aria-label="Download image"
        title="Download image"
        className={`inline-flex items-center justify-center ${sizeCls} rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink transition disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {busy === "download" ? <Spinner /> : <DownloadIcon />}
      </button>

      {status && (
        <span
          className={[
            "text-[12px] font-medium px-2 py-1 rounded-full ml-1",
            status.kind === "ok"
              ? "text-brand bg-brand/10 border border-brand/20"
              : "text-danger bg-danger/10 border border-danger/20",
          ].join(" ")}
        >
          {status.msg}
        </span>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────

async function copyImageToClipboard(png: Blob): Promise<void> {
  const Item = (window as unknown as {
    ClipboardItem?: new (
      items: Record<string, Blob | Promise<Blob>>
    ) => unknown;
  }).ClipboardItem;
  if (!Item) throw new Error("Clipboard images not supported on this browser");
  const item = new Item({ "image/png": png }) as unknown as ClipboardItem;
  await navigator.clipboard.write([item]);
}

function SocialBtn({
  label,
  busy,
  disabled,
  onClick,
  children,
  bg,
  text,
  sizeCls,
}: {
  target: Target;
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
  bg: string;
  text: string;
  sizeCls: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "inline-flex items-center justify-center rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed",
        sizeCls,
        bg,
        text,
        busy ? "opacity-70" : "hover:scale-105 active:scale-95",
      ].join(" ")}
    >
      {busy ? <Spinner /> : children}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────
// Icons
// ───────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.785l-5.31-6.49L4.8 22H1.54l8.05-9.2L1 2h6.943l4.8 5.93L18.244 2zm-1.19 18h1.787L7.04 4H5.14l11.913 16z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.563 9.876v-6.984h-2.54V12h2.54V9.797c0-2.507 1.492-3.892 3.777-3.892 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.772-1.63 1.563V12h2.773l-.443 2.892h-2.33v6.984A10.002 10.002 0 0 0 22 12z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.452 20.452h-3.554v-5.568c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.137 1.447-2.137 2.94v5.665H9.355V9h3.414v1.561h.046c.476-.9 1.637-1.852 3.37-1.852 3.602 0 4.267 2.37 4.267 5.455v6.288zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.115 20.452H3.554V9h3.561v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.728v20.544C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.272V1.728C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
