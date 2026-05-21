// 3-tier logo resolver.
//
// Tier 1 — Plaid counterparties. When a Plaid stream's enriched data
//          includes counterparties[0].logo_url, use it. Plaid does the
//          heavy lifting and these URLs are CDN-hosted, high quality.
//
// Tier 2 — Domain logo API. We resolve a domain (from Plaid's website
//          field if present, otherwise from our domain map in
//          lib/logos.ts) and ask Google's favicon endpoint. Free, no
//          API key. Swap to Logo.dev or Brandfetch by changing
//          logoUrlForDomain() — the resolver contract stays the same.
//
// Tier 3 — Deterministic monogram. A stable initials avatar derived
//          from the merchant name. Background color is a hash of the
//          name so the same merchant always gets the same color. This
//          is the guaranteed fallback — there is no "no logo" state.
//
// All resolved URLs are cached in the merchant_logos table keyed by
// domain (or merchant_entity_id from Plaid). A second user pulling the
// same merchant pays nothing — they read straight from cache.
//
// FRONT-END CONTRACT: every <img> rendering a tier-1 or tier-2 result
// MUST attach an onError that swaps to the tier-3 monogram. The
// resolver's job is to nominate a URL; the renderer's job is to never
// show a broken image.

import { supabaseAdmin } from "./supabase";
import { domainFor, logoUrl, monogram, monogramColor } from "./logos";

export type LogoSource = "plaid" | "logo_api" | "monogram";

export type ResolvedLogo = {
  source: LogoSource;
  // Tier 1 + 2 produce a URL. Tier 3 returns null here and the caller
  // renders the inline SVG via monogramSvg().
  url: string | null;
  // Monogram inputs — always present so the caller can render the
  // fallback even when source !== 'monogram'.
  monogram: {
    initials: string;
    color: string;
  };
};

export type ResolveInput = {
  merchant: string;            // cleaned display name
  category?: string | null;
  // Plaid enriched counterparty data, if available on the underlying
  // transactions. The logo_url here is tier 1.
  plaidLogoUrl?: string | null;
  plaidWebsite?: string | null;
  plaidMerchantEntityId?: string | null;
};

// ------------- public entry point -------------

export async function resolveLogo(input: ResolveInput): Promise<ResolvedLogo> {
  const fallback = {
    initials: monogram(input.merchant),
    color: monogramColor(input.category),
  };

  // Tier 1 — Plaid.
  if (input.plaidLogoUrl) {
    await persistCache({
      domain: domainFromAny(input),
      entityId: input.plaidMerchantEntityId ?? null,
      url: input.plaidLogoUrl,
      source: "plaid",
    });
    return {
      source: "plaid",
      url: input.plaidLogoUrl,
      monogram: fallback,
    };
  }

  // Tier 2 — Domain lookup.
  const domain = domainFromAny(input);
  if (domain) {
    // Cache hit?
    const cached = await readCache(domain, input.plaidMerchantEntityId ?? null);
    if (cached) {
      return {
        source: cached.source,
        url: cached.logo_url,
        monogram: fallback,
      };
    }
    const url = logoUrlForDomain(domain);
    await persistCache({
      domain,
      entityId: input.plaidMerchantEntityId ?? null,
      url,
      source: "logo_api",
    });
    return { source: "logo_api", url, monogram: fallback };
  }

  // Tier 3 — Monogram. Cache it so we don't churn on the next scan.
  await persistCache({
    domain: null,
    entityId: input.plaidMerchantEntityId ?? null,
    url: null,
    source: "monogram",
  });
  return { source: "monogram", url: null, monogram: fallback };
}

// ------------- domain resolution -------------

function domainFromAny(input: ResolveInput): string | null {
  // Plaid's `website` field is sometimes a bare domain, sometimes a
  // full URL. Normalize to host without scheme.
  if (input.plaidWebsite) {
    try {
      const u = input.plaidWebsite.includes("://")
        ? new URL(input.plaidWebsite)
        : new URL("https://" + input.plaidWebsite);
      return u.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      // fall through
    }
  }
  const local = domainFor(input.merchant);
  return local ? local.toLowerCase() : null;
}

// Swap the body of this function to point at Logo.dev or Brandfetch.
// Their interfaces are similar: GET https://img.logo.dev/{domain}?token=XXX
// for Logo.dev. We use Google's free favicon API by default to avoid an
// extra service dependency.
export function logoUrlForDomain(domain: string): string {
  return logoUrl(domain, 128);
}

// ------------- cache -------------

type CacheRow = {
  domain: string | null;
  entityId: string | null;
  url: string | null;
  source: LogoSource;
};

async function readCache(
  domain: string | null,
  entityId: string | null
): Promise<{ logo_url: string | null; source: LogoSource } | null> {
  if (!supabaseAdmin) return null;
  try {
    if (entityId) {
      const { data } = await supabaseAdmin
        .from("merchant_logos")
        .select("logo_url, source")
        .eq("merchant_entity_id", entityId)
        .maybeSingle();
      if (data) {
        return {
          logo_url: data.logo_url as string | null,
          source: data.source as LogoSource,
        };
      }
    }
    if (domain) {
      const { data } = await supabaseAdmin
        .from("merchant_logos")
        .select("logo_url, source")
        .eq("domain", domain)
        .maybeSingle();
      if (data) {
        return {
          logo_url: data.logo_url as string | null,
          source: data.source as LogoSource,
        };
      }
    }
  } catch {
    // Cache miss is non-fatal; we'll just resolve fresh.
  }
  return null;
}

async function persistCache(row: CacheRow): Promise<void> {
  if (!supabaseAdmin) return;
  // Don't poison the cache with empty-key writes.
  if (!row.domain && !row.entityId) return;
  try {
    await supabaseAdmin.from("merchant_logos").upsert(
      {
        domain: row.domain,
        merchant_entity_id: row.entityId,
        logo_url: row.url,
        source: row.source,
        fetched_at: new Date().toISOString(),
      },
      // Prefer entity_id when present, else domain.
      { onConflict: row.entityId ? "merchant_entity_id" : "domain" }
    );
  } catch {
    // Best-effort cache write. A failure here doesn't break the resolve.
  }
}

// ------------- monogram SVG (tier 3) -------------
//
// Returned as a data URL so the caller can drop it straight into an
// <img src>. Stable per merchant — same input always produces the same
// SVG so React doesn't re-render on every scan.

export function monogramSvgDataUrl(initials: string, color: string): string {
  const safeColor = encodeURIComponent(color);
  const safeInitials = (initials || "?")
    .slice(0, 2)
    .toUpperCase()
    .replace(/[<>&"]/g, "");
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>` +
    `<rect width='40' height='40' rx='10' fill='${color}'/>` +
    `<text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' ` +
    `font-family='-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' ` +
    `font-size='15' font-weight='600' fill='white'>${safeInitials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${svg.replace(/#/g, "%23").replace(/'/g, "%27")}`;
}

// Re-export so callers don't need to import from two places.
export { monogram, monogramColor };
