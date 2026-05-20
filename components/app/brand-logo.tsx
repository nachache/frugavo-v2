"use client";

import { useState } from "react";
import { clearbitUrl, domainFor, monogram, monogramColor } from "@/lib/logos";

// Renders a brand logo via Clearbit when we have a domain mapping,
// otherwise a colored monogram avatar. The img is given an onError
// handler so a 404 (Clearbit doesn't have that brand) collapses to the
// monogram without a broken-image flash.

type Size = 32 | 40 | 56 | 64;

const SIZE_CLS: Record<Size, string> = {
  32: "h-8 w-8 text-[11px]",
  40: "h-10 w-10 text-[13px]",
  56: "h-14 w-14 text-[16px]",
  64: "h-16 w-16 text-[18px]",
};

type Props = {
  merchant: string;
  category?: string | null;
  size?: Size;
  className?: string;
};

export function BrandLogo({
  merchant,
  category,
  size = 40,
  className,
}: Props) {
  const domain = domainFor(merchant);
  const [errored, setErrored] = useState(false);
  const sizeCls = SIZE_CLS[size];
  const bg = monogramColor(category);

  if (!domain || errored) {
    return (
      <div
        className={`${sizeCls} shrink-0 inline-flex items-center justify-center rounded-xl font-semibold text-white ${className ?? ""}`}
        style={{ backgroundColor: bg }}
        aria-hidden
      >
        {monogram(merchant)}
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={clearbitUrl(domain, size * 2)}
      alt=""
      onError={() => setErrored(true)}
      loading="lazy"
      decoding="async"
      className={`${sizeCls} shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-black/[0.04] ${className ?? ""}`}
    />
  );
}
