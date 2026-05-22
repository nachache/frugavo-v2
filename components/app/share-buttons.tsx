"use client";

// Share controls — share the IMAGE, not a link to the website.
//
// Strategy:
//   1. Primary "Share" button uses the Web Share API with files.
//      navigator.share({ files: [...] }) on iOS / Android / modern
//      Chrome opens the native system share sheet pre-loaded with the
//      share-card PNG. The user picks Instagram, WhatsApp, Messages,
//      X, etc. — and the IMAGE is what gets attached, not a link.
//
//   2. "Copy image" copies the PNG to the system clipboard so the
//      user can paste it directly into a post composer. Uses the
//      Clipboard API's `write` method with a ClipboardItem holding
//      image/png.
//
//   3. "Download" forces a save. Works everywhere as a final
//      fallback — once saved, the user attaches it to whatever
//      sharer they prefer.
//
// We deliberately drop the old X / Facebook / LinkedIn web-intent
// buttons. Those only ever sent the link "frugavo.com", not the
// image, which is the exact failure mode the user reported. If those
// buttons return later they should attach an image — which requires
// either a public OG endpoint or backend upload to a media host.
//
// Why we convert SVG → PNG client-side:
//   - The share-card endpoint returns SVG (small, crisp, server-
//     deterministic). Twitter, Instagram, etc. accept PNG/JPEG only.
//   - We rasterize once on-demand using <canvas>; result is cached
//     in component state so multiple share targets reuse the same
//     bytes.

import { useCallback, useRef, useState } from "react";

type Props = {
  shareType: string;
  shareText: string;
  compact?: boolean;
  /** 1080 default; identity card uses 1080 too. */
  rasterSize?: number;
};

const DEFAULT_RASTER_SIZE = 1080;

export function ShareButtons({
  shareType,
  shareText,
  compact,
  rasterSize = DEFAULT_RASTER_SIZE,
}: Props) {
  const pngBlobRef = useRef<Blob | null>(null);
  const [status, setStatus] = useState<null | { kind: "ok" | "err"; msg: string }>(null);
  const [busy, setBusy] = useState(false);

  const flash = useCallback((kind: "ok" | "err", msg: string) => {
    setStatus({ kind, msg });
    setTimeout(() => setStatus(null), 1800);
  }, []);

  // Lazy SVG → PNG conversion. Cached after first call.
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
      // Square crop is fine for monthly_burn / yearly_total / ai_stack
      // (1200x1200) and the identity card SVG (1080x1350 — preserve
      // its aspect ratio by reading the rendered intrinsic size).
      const naturalW = img.naturalWidth || rasterSize;
      const naturalH = img.naturalHeight || rasterSize;
      canvas.width = naturalW;
      canvas.height = naturalH;
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
  }, [rasterSize, shareType]);

  // ---- Action handlers ----

  const onShare = useCallback(async () => {
    setBusy(true);
    try {
      const png = await buildPng();
      const file = new File([png], `frugavo-${shareType}.png`, {
        type: "image/png",
      });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      // Files first — Instagram / WhatsApp / Messages support it.
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Frugavo",
          text: shareText,
        });
        flash("ok", "Shared");
        return;
      }
      // Text-only fallback if files aren't supported (some desktop
      // browsers). Still uses native share sheet where available.
      if (nav.share) {
        await nav.share({
          title: "Frugavo",
          text: shareText,
        });
        flash("ok", "Shared");
        return;
      }
      // Last resort — copy the image to clipboard.
      await copyImageToClipboard(png);
      flash("ok", "Image copied — paste in your app");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("abort")) {
        // User cancelled the share sheet — silent.
        return;
      }
      flash("err", "Share failed");
    } finally {
      setBusy(false);
    }
  }, [buildPng, flash, shareText, shareType]);

  const onCopy = useCallback(async () => {
    setBusy(true);
    try {
      const png = await buildPng();
      await copyImageToClipboard(png);
      flash("ok", "Image copied");
    } catch {
      flash("err", "Copy failed");
    } finally {
      setBusy(false);
    }
  }, [buildPng, flash]);

  const onDownload = useCallback(async () => {
    setBusy(true);
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
      setBusy(false);
    }
  }, [buildPng, flash, shareType]);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <IconBtn label="Share" disabled={busy} onClick={onShare}>
          <ShareIcon />
        </IconBtn>
        <IconBtn label="Copy image" disabled={busy} onClick={onCopy}>
          <CopyIcon />
        </IconBtn>
        <IconBtn label="Download image" disabled={busy} onClick={onDownload}>
          <DownloadIcon />
        </IconBtn>
        {status && <Toast kind={status.kind}>{status.msg}</Toast>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PrimaryBtn disabled={busy} onClick={onShare}>
        <ShareIcon />
        Share image
      </PrimaryBtn>
      <SecondaryBtn disabled={busy} onClick={onCopy}>
        <CopyIcon />
        Copy image
      </SecondaryBtn>
      <SecondaryBtn disabled={busy} onClick={onDownload}>
        <DownloadIcon />
        Download
      </SecondaryBtn>
      {status && <Toast kind={status.kind}>{status.msg}</Toast>}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────

async function copyImageToClipboard(png: Blob): Promise<void> {
  const Item = (
    window as unknown as {
      ClipboardItem?: new (
        items: Record<string, Blob | Promise<Blob>>
      ) => unknown;
    }
  ).ClipboardItem;
  if (!Item) throw new Error("Clipboard images not supported on this browser");
  const item = new Item({ "image/png": png }) as unknown as ClipboardItem;
  await navigator.clipboard.write([item]);
}

// ───────────────────────────────────────────────────────────────────
// Buttons / toast
// ───────────────────────────────────────────────────────────────────

function PrimaryBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink text-canvas hover:bg-ink/85 transition text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function SecondaryBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 h-10 px-3 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink transition text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function IconBtn({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function Toast({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: "ok" | "err";
}) {
  return (
    <span
      className={[
        "text-[12px] font-medium px-2 py-1 rounded-full",
        kind === "ok"
          ? "text-brand bg-brand/10 border border-brand/20"
          : "text-danger bg-danger/10 border border-danger/20",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────
// Icons (currentColor)
// ───────────────────────────────────────────────────────────────────

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
