"use client";

import {
  SiNetflix,
  SiSpotify,
  SiAdobecreativecloud,
  SiNewyorktimes,
  SiPeloton,
  SiLinkedin,
  SiAudible,
  SiHellofresh,
  SiApplemusic,
  SiTidal,
  SiNotion,
  SiDropbox,
  SiCanva,
  SiThewashingtonpost,
  SiSubstack,
  SiStrava,
  SiHeadspace,
  SiDoordash,
  SiUber,
  SiInstacart,
  SiHbo,
  SiParamountplus,
  SiMax,
  SiMicrosoft,
} from "react-icons/si";
import type { IconType } from "react-icons";
import { cn } from "@/lib/utils";

type Cfg = { Icon: IconType; bg: string; fg: string };

// Brand-by-brand palette. Each tile uses the brand's own primary colors so
// each mark feels authentic rather than uniformly flat. Glyphs come from
// Simple Icons (MIT licensed) via react-icons/si.

const MAP: Record<string, Cfg> = {
  // The 8 inbox demo subs
  netflix: { Icon: SiNetflix, bg: "#000000", fg: "#E50914" },
  spotify: { Icon: SiSpotify, bg: "#1DB954", fg: "#FFFFFF" },
  adobe: { Icon: SiAdobecreativecloud, bg: "#FA0F00", fg: "#FFFFFF" },
  nyt: { Icon: SiNewyorktimes, bg: "#FFFFFF", fg: "#000000" },
  peloton: { Icon: SiPeloton, bg: "#000000", fg: "#FFFFFF" },
  linkedin: { Icon: SiLinkedin, bg: "#0A66C2", fg: "#FFFFFF" },
  audible: { Icon: SiAudible, bg: "#F8991C", fg: "#FFFFFF" },
  hellofresh: { Icon: SiHellofresh, bg: "#7FB800", fg: "#FFFFFF" },

  // Providers section — only brands with a Simple Icons glyph. Anything not
  // in this map falls back to the Monogram tile.
  "apple-music": { Icon: SiApplemusic, bg: "#FA243C", fg: "#FFFFFF" },
  tidal: { Icon: SiTidal, bg: "#000000", fg: "#FFFFFF" },
  microsoft: { Icon: SiMicrosoft, bg: "#FFFFFF", fg: "#0078D4" },
  notion: { Icon: SiNotion, bg: "#FFFFFF", fg: "#000000" },
  dropbox: { Icon: SiDropbox, bg: "#0061FF", fg: "#FFFFFF" },
  canva: { Icon: SiCanva, bg: "#00C4CC", fg: "#FFFFFF" },
  wapo: { Icon: SiThewashingtonpost, bg: "#000000", fg: "#FFFFFF" },
  substack: { Icon: SiSubstack, bg: "#FF6719", fg: "#FFFFFF" },
  strava: { Icon: SiStrava, bg: "#FC4C02", fg: "#FFFFFF" },
  headspace: { Icon: SiHeadspace, bg: "#F47D31", fg: "#FFFFFF" },
  doordash: { Icon: SiDoordash, bg: "#FF3008", fg: "#FFFFFF" },
  "uber-one": { Icon: SiUber, bg: "#000000", fg: "#FFFFFF" },
  instacart: { Icon: SiInstacart, bg: "#43B02A", fg: "#FFFFFF" },
  max: { Icon: SiMax, bg: "#000000", fg: "#FFFFFF" },
  hbo: { Icon: SiHbo, bg: "#000000", fg: "#FFFFFF" },
  "paramount-plus": { Icon: SiParamountplus, bg: "#0064FF", fg: "#FFFFFF" },
};

type Size = "sm" | "md" | "lg";

const tile: Record<Size, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-10 w-10 rounded-xl",
  lg: "h-12 w-12 rounded-xl",
};

const iconPx: Record<Size, number> = { sm: 14, md: 18, lg: 22 };

export function BrandIcon({
  id,
  size = "md",
  className,
  fallback,
}: {
  id: string;
  size?: Size;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const cfg = MAP[id];
  if (!cfg) return <>{fallback ?? null}</>;

  const { Icon, bg, fg } = cfg;

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        tile[size],
        // hairline border on white tiles so they read on cream backgrounds
        bg.toUpperCase() === "#FFFFFF" && "border border-hairline",
        className
      )}
      style={{ background: bg }}
    >
      <Icon size={iconPx[size]} color={fg} />
    </span>
  );
}

export function isKnownBrand(id: string) {
  return id in MAP;
}
