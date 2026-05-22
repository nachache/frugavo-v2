"use client";

// Social-media share-button row.
//
// Renders X (Twitter), Facebook, LinkedIn, Copy-link, and Download.
// Two layouts:
//   compact = inline single row of small icon buttons (used inside
//             share-card thumbnails)
//   default = full row with labels (used next to the identity card)
//
// Notes:
//   - X / Facebook / LinkedIn open native share intents in a new tab.
//   - Instagram has no public share intent — provide a Download button
//     and tell the user to attach the saved image to their story.
//   - The share-card SVG URL itself is auth-gated, so links that point
//     at /api/share-card/* only work for the sharer (great for "post
//     a screenshot" workflows; you can't link directly to someone
//     else's card). Public OG-image support is a future iteration.

import { useState } from "react";

type Props = {
  shareType: string; // "identity" | "monthly_burn" | "yearly_total" | "ai_stack"
  shareText: string;
  compact?: boolean;
};

export function ShareButtons({ shareType, shareText, compact }: Props) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/` : "https://frugavo.com/";
  const encText = encodeURIComponent(`${shareText}\n\nTracked with Frugavo.`);
  const encUrl = encodeURIComponent(url);

  const xUrl = `https://twitter.com/intent/tweet?text=${encText}&url=${encUrl}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encUrl}&quote=${encText}`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`;
  const dlUrl = `/api/share-card/${shareType}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // older browsers — silent fallback
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <IconLink href={xUrl} title="Post on X" compact>
          <XIcon />
        </IconLink>
        <IconLink href={fbUrl} title="Share on Facebook" compact>
          <FacebookIcon />
        </IconLink>
        <IconLink href={dlUrl} title="Open card" compact download>
          <DownloadIcon />
        </IconLink>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconLink href={xUrl} title="Post on X">
        <XIcon />
        <span className="text-[13px] font-medium">X</span>
      </IconLink>
      <IconLink href={fbUrl} title="Share on Facebook">
        <FacebookIcon />
        <span className="text-[13px] font-medium">Facebook</span>
      </IconLink>
      <IconLink href={liUrl} title="Share on LinkedIn">
        <LinkedInIcon />
        <span className="text-[13px] font-medium">LinkedIn</span>
      </IconLink>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-2 h-10 px-3 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink transition"
        title="Copy share link"
      >
        <CopyIcon />
        <span className="text-[13px] font-medium">
          {copied ? "Copied" : "Copy"}
        </span>
      </button>
      <a
        href={dlUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 h-10 px-3 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink transition"
        title="Open card image"
      >
        <DownloadIcon />
        <span className="text-[13px] font-medium">Download</span>
      </a>
    </div>
  );
}

function IconLink({
  href,
  title,
  children,
  compact,
  download,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
  compact?: boolean;
  download?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      {...(download ? {} : {})}
      className={
        compact
          ? "inline-flex items-center justify-center h-8 w-8 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink transition"
          : "inline-flex items-center gap-2 h-10 px-3 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink transition"
      }
    >
      {children}
    </a>
  );
}

// ─── Brand icon SVGs (currentColor; no external CDN) ───────────────

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.785l-5.31-6.49L4.8 22H1.54l8.05-9.2L1 2h6.943l4.8 5.93L18.244 2zm-1.19 18h1.787L7.04 4H5.14l11.913 16z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.563 9.876v-6.984h-2.54V12h2.54V9.797c0-2.507 1.492-3.892 3.777-3.892 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.772-1.63 1.563V12h2.773l-.443 2.892h-2.33v6.984A10.002 10.002 0 0 0 22 12z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.452 20.452h-3.554v-5.568c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.137 1.447-2.137 2.94v5.665H9.355V9h3.414v1.561h.046c.476-.9 1.637-1.852 3.37-1.852 3.602 0 4.267 2.37 4.267 5.455v6.288zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.115 20.452H3.554V9h3.561v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.728v20.544C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.272V1.728C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
