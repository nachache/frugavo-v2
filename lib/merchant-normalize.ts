// Deterministic merchant normalization.
//
// Input: raw bank descriptor (and optionally Plaid's merchant_name).
// Output: { merchant_name, category, biller, signals } — fully determined
// by the input + the static catalog. No LLM, no Date.now(), no I/O.
//
// Pipeline:
//   1. Lowercase + collapse whitespace.
//   2. Strip processor prefixes (SQ *, PAYPAL *, TST*, etc.) from the
//      front. The catalog supplies the regex list — banks invent new
//      prefixes constantly, so this is an asset we update, not code.
//   3. Strip trailing noise (account numbers, store codes, phone
//      fragments, ID:..., REF:..., trailing US state codes).
//   4. Biller resolution. If what remains matches a known biller (Apple,
//      Google Play, PayPal, Stripe, Square), the merchant is recorded
//      as `biller_passthrough = true` so the scan layer knows to look
//      INSIDE the descriptor for the underlying product, and to split
//      single-biller lines into separate subscriptions when distinct
//      amounts recur.
//   5. Catalog lookup against merchant aliases and domains. First hit
//      wins — order in the catalog determines tie-breaks (alphabetical
//      by key in the JSON, so deterministic).
//   6. Bank-fees detection. If any bank_fee_indicator phrase appears
//      anywhere in the original descriptor, category overrides to
//      `bank_fees` and merchant_name is the cleaned phrase. Bank fees
//      get a dedicated category so they never hide inside "Other."
//   7. Domain heuristic. If the cleaned string still contains a
//      "*.tld" pattern (eg. "mailerlite.com"), we use the domain as
//      the merchant key and Title-Case the second-level label.
//   8. Final fallback: Title-Case the cleaned descriptor.
//
// This module is pure. Every step above is exercised by
// tests/unit/merchant-normalize.spec.ts against SYNTHETIC strings
// matching the documented patterns — never real user data.

import catalog from "./data/merchant-catalog.json";

export type NormalizedMerchant = {
  merchant_name: string;
  category: string;
  biller: string | null;
  biller_passthrough: boolean;
  domain: string | null;
  catalog_key: string | null;
  signals: {
    stripped_prefix: string | null;
    stripped_trailing: string | null;
    matched_alias: string | null;
    matched_domain: string | null;
    bank_fee_indicator: string | null;
  };
};

type CatalogShape = {
  processor_prefixes: string[];
  trailing_noise: string[];
  billers: {
    key: string;
    display: string;
    aliases: string[];
    domains: string[];
  }[];
  merchants: {
    key: string;
    display: string;
    category: string;
    aliases: string[];
    domains: string[];
  }[];
  bank_fee_indicators: string[];
};

const C = catalog as unknown as CatalogShape;

// Pre-compile regexes at module load so per-call cost is just .test().
// Anchored at start for prefixes, anchored at end for trailing.
const PREFIX_REGEXES = C.processor_prefixes.map(
  (src) => new RegExp(`^\\s*${src}\\s*`, "i")
);
const TRAILING_REGEXES = C.trailing_noise.map(
  (src) => new RegExp(src, "i")
);

// Catalog index: alias (lower) → entry. Built once.
type AliasHit = {
  kind: "merchant" | "biller";
  key: string;
  display: string;
  category: string; // billers report "other" — the SCAN layer fills in the wrapped product's category
  domains: string[];
  ai?: boolean; // mirrors merchants[].ai from catalog
};
const ALIAS_INDEX: Map<string, AliasHit> = (() => {
  const m = new Map<string, AliasHit>();
  // Order matters for determinism. We index BILLERS first so a string
  // matching both a biller alias and a merchant alias resolves to the
  // biller — which lets the scan layer split sub-charges out.
  for (const b of C.billers) {
    for (const a of [b.display, ...b.aliases]) {
      m.set(a.toLowerCase(), {
        kind: "biller",
        key: b.key,
        display: b.display,
        category: "other",
        domains: b.domains,
      });
    }
  }
  for (const merch of C.merchants) {
    for (const a of [merch.display, ...merch.aliases]) {
      // Don't clobber a biller key with a merchant alias.
      if (m.has(a.toLowerCase())) continue;
      m.set(a.toLowerCase(), {
        kind: "merchant",
        key: merch.key,
        display: merch.display,
        category: merch.category,
        domains: merch.domains,
        ai: (merch as { ai?: boolean }).ai === true,
      });
    }
  }
  return m;
})();

// Subset index of AI-tagged merchants only. Used by the biller-
// passthrough inheritance check: when a biller alias matches (e.g.
// Paddle, Stripe), we also scan the rest of the descriptor for any
// AI merchant alias and prefer the AI hit so the engine groups the
// charge under the real product (n8n, Anthropic, OpenAI, etc.) and
// the insights layer can count it toward the AI bucket.
const AI_ALIASES: string[] = (() => {
  const out: string[] = [];
  for (const [alias, hit] of ALIAS_INDEX) {
    if (hit.ai === true && alias.length >= 3) out.push(alias);
  }
  // Sort descending by length so longer aliases win in substring scan
  // ("openai chatgpt" beats "openai" beats "ai").
  return out.sort((a, b) => b.length - a.length);
})();

const DOMAIN_INDEX: Map<string, AliasHit> = (() => {
  const m = new Map<string, AliasHit>();
  for (const b of C.billers) {
    for (const d of b.domains) {
      m.set(d.toLowerCase(), {
        kind: "biller",
        key: b.key,
        display: b.display,
        category: "other",
        domains: b.domains,
      });
    }
  }
  for (const merch of C.merchants) {
    for (const d of merch.domains) {
      if (m.has(d.toLowerCase())) continue;
      m.set(d.toLowerCase(), {
        kind: "merchant",
        key: merch.key,
        display: merch.display,
        category: merch.category,
        domains: merch.domains,
      });
    }
  }
  return m;
})();

// --- Pipeline steps ---

function lower(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function stripPrefix(s: string): { cleaned: string; stripped: string | null } {
  for (const re of PREFIX_REGEXES) {
    const m = s.match(re);
    if (m) {
      const rest = s.slice(m[0].length).trim();
      // If stripping the prefix consumes the ENTIRE descriptor, the
      // prefix itself IS the merchant identity. e.g. "Apple.com/Bill"
      // standalone means an Apple charge for an unknown product; only
      // "Apple.com/Bill Netflix" should have "Apple.com/Bill" stripped
      // off to expose Netflix. Without this guard, the catalog lookup
      // runs on an empty string and falls through to the title-cased
      // raw descriptor — losing the biller_passthrough flag and the
      // amount-bucketing that depends on it.
      if (rest.length === 0) continue;
      return { cleaned: rest, stripped: m[0].trim() };
    }
  }
  return { cleaned: s, stripped: null };
}

function stripTrailing(s: string): { cleaned: string; stripped: string | null } {
  let out = s;
  let removed: string | null = null;
  for (const re of TRAILING_REGEXES) {
    const m = out.match(re);
    if (m && m.index !== undefined) {
      removed = (removed ?? "") + m[0];
      out = out.slice(0, m.index).trim();
    }
  }
  return { cleaned: out, stripped: removed };
}

function findDomain(s: string): string | null {
  const m = s.match(/\b([a-z0-9-]+\.[a-z]{2,})(?:\/[^\s]*)?\b/i);
  return m ? m[1].toLowerCase() : null;
}

function findBankFeeIndicator(originalLower: string): string | null {
  for (const ind of C.bank_fee_indicators) {
    if (originalLower.includes(ind.toLowerCase())) return ind;
  }
  return null;
}

function lookupByAliases(cleaned: string): {
  hit: AliasHit | null;
  matchedAlias: string | null;
  // True when we promoted an inner AI merchant out of a wrapping
  // biller (Paddle/Stripe/Square). Caller must force biller_passthrough
  // on the resulting normalization so amount-bucketing still groups
  // distinct products under the biller umbrella correctly.
  biller_passthrough_override?: boolean;
} {
  const cleanedLower = cleaned.toLowerCase();

  // Helper: scan the cleaned descriptor for an AI catalog alias. Used
  // both for biller-passthrough inheritance and as a final defense
  // against billers swallowing the real merchant identity.
  const findAiInside = (): { hit: AliasHit; alias: string } | null => {
    for (const alias of AI_ALIASES) {
      if (!cleanedLower.includes(alias)) continue;
      const hit = ALIAS_INDEX.get(alias);
      if (hit) return { hit, alias };
    }
    return null;
  };

  // Pass 1: token-prefix match, where "tokens" are split on whitespace
  // AND on bank-descriptor separators (* / -). This catches the very
  // common case where a bank squishes brand and product together —
  // "OPENAI*CHATGPT", "MICROSOFT*365", "GOOGLE*WORKSPACE", "GG*GOOGLE
  // PLAY" — none of which would split on whitespace alone.
  const tokens = cleaned.split(/[\s*/\-]+/).filter((t) => t.length > 0);
  for (let len = tokens.length; len >= 1; len--) {
    const candidate = tokens.slice(0, len).join(" ").toLowerCase();
    const hit = ALIAS_INDEX.get(candidate);
    if (hit) {
      // Biller-passthrough AI inheritance: if the primary hit is a
      // biller (Paddle, Stripe, Square, Apple, Google Play, PayPal),
      // check whether the rest of the descriptor names an AI merchant.
      // If yes, prefer the AI merchant — same charge, but grouped and
      // categorized under the actual product the user is paying for.
      if (hit.kind === "biller") {
        const inner = findAiInside();
        if (inner && inner.hit.key !== hit.key) {
          return {
            hit: inner.hit,
            matchedAlias: inner.alias,
            biller_passthrough_override: true,
          };
        }
      }
      return { hit, matchedAlias: candidate };
    }
  }
  // Also try right-anchored token suffixes — "spotify usa inc" should
  // hit "spotify usa" even though "inc" is the trailing token.
  for (let start = 0; start < tokens.length; start++) {
    for (let end = tokens.length; end > start; end--) {
      if (start === 0 && end === tokens.length) continue; // already tried
      const candidate = tokens.slice(start, end).join(" ").toLowerCase();
      const hit = ALIAS_INDEX.get(candidate);
      if (hit) {
        if (hit.kind === "biller") {
          const inner = findAiInside();
          if (inner && inner.hit.key !== hit.key) {
            return {
              hit: inner.hit,
              matchedAlias: inner.alias,
              biller_passthrough_override: true,
            };
          }
        }
        return { hit, matchedAlias: candidate };
      }
    }
  }

  // Pass 2: substring fallback. For each alias in the catalog, check
  // whether it appears as a whole-word substring of the cleaned
  // descriptor. Bounded by alias length — short aliases like "go" are
  // skipped to avoid false matches.
  //
  // This catches glued-together descriptors that survive the
  // multi-separator tokenizer above ("OPENAI*CHATGPT.AI" → "openai"
  // substring matches the openai alias).
  let best: { hit: AliasHit; alias: string } | null = null;
  for (const [alias, hit] of ALIAS_INDEX) {
    if (alias.length < 4) continue; // skip short generic tokens
    if (!cleanedLower.includes(alias)) continue;
    if (!best || alias.length > best.alias.length) {
      best = { hit, alias };
    }
  }
  if (best) {
    if (best.hit.kind === "biller") {
      const inner = findAiInside();
      if (inner && inner.hit.key !== best.hit.key) {
        return {
          hit: inner.hit,
          matchedAlias: inner.alias,
          biller_passthrough_override: true,
        };
      }
    }
    return { hit: best.hit, matchedAlias: best.alias };
  }

  return { hit: null, matchedAlias: null };
}

function lookupByDomain(cleaned: string): {
  hit: AliasHit | null;
  matchedDomain: string | null;
} {
  const dom = findDomain(cleaned);
  if (!dom) return { hit: null, matchedDomain: null };
  const hit = DOMAIN_INDEX.get(dom);
  if (hit) return { hit, matchedDomain: dom };
  return { hit: null, matchedDomain: dom };
}

function titleCase(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

// --- Public API ---

export function normalizeDescriptor(rawDescriptor: string): NormalizedMerchant {
  const original = rawDescriptor ?? "";
  const lowered = lower(original);

  const bankFee = findBankFeeIndicator(lowered);

  // ─── Pre-strip catalog lookup (brand-token priority) ────────────
  //
  // Processor-prefix stripping (next step) is destructive: "GOOGLE
  // *STORAGE" reduces to "storage" and the catalog never gets a
  // chance to see "google storage"; "AMZN MKTP US*M21K78Q" reduces
  // to noise tokens and the three Amazon variants never group.
  //
  // We run the catalog lookup against the un-stripped descriptor
  // first. If a MERCHANT alias matches (not a biller — billers must
  // still flow through the strip pipeline so their inner product
  // gets extracted), we use that merchant and skip stripping. This
  // is the brand-token-over-positional-token priority fix.
  const preStrip = lookupByAliases(lowered);
  if (preStrip.hit && preStrip.hit.kind === "merchant") {
    return {
      merchant_name: preStrip.hit.display,
      category: preStrip.hit.category,
      biller: null,
      biller_passthrough: preStrip.biller_passthrough_override === true,
      domain: preStrip.hit.domains[0] ?? null,
      catalog_key: preStrip.hit.key,
      signals: {
        stripped_prefix: null,
        stripped_trailing: null,
        matched_alias: preStrip.matchedAlias,
        matched_domain: null,
        bank_fee_indicator: bankFee,
      },
    };
  }

  const { cleaned: afterPrefix, stripped: strippedPrefix } = stripPrefix(lowered);
  const { cleaned: afterTrailing, stripped: strippedTrailing } =
    stripTrailing(afterPrefix);

  // Bank-fee override comes early — once we know this is a fee row, we
  // don't want catalog matching to mislabel it. Title-case the matched
  // indicator as the merchant name.
  if (bankFee) {
    return {
      merchant_name: titleCase(bankFee),
      category: "bank_fees",
      biller: null,
      biller_passthrough: false,
      domain: null,
      catalog_key: null,
      signals: {
        stripped_prefix: strippedPrefix,
        stripped_trailing: strippedTrailing,
        matched_alias: null,
        matched_domain: null,
        bank_fee_indicator: bankFee,
      },
    };
  }

  const {
    hit: aliasHit,
    matchedAlias,
    biller_passthrough_override,
  } = lookupByAliases(afterTrailing);
  const { hit: domainHit, matchedDomain } = lookupByDomain(afterTrailing);
  const hit = aliasHit ?? domainHit;

  if (hit) {
    // biller_passthrough is true when:
    //   - the catalog match is itself a biller (Apple, Paddle, etc.), OR
    //   - we promoted an inner AI merchant up out of a biller wrapper,
    //     in which case the original wrapper still affects how distinct
    //     products posted under the same biller need to be bucketed
    //     by amount.
    const passthrough =
      biller_passthrough_override === true || hit.kind === "biller";
    return {
      merchant_name: hit.display,
      category: hit.category,
      biller: hit.kind === "biller" ? hit.key : null,
      biller_passthrough: passthrough,
      domain: matchedDomain ?? hit.domains[0] ?? null,
      catalog_key: hit.key,
      signals: {
        stripped_prefix: strippedPrefix,
        stripped_trailing: strippedTrailing,
        matched_alias: matchedAlias,
        matched_domain: matchedDomain,
        bank_fee_indicator: null,
      },
    };
  }

  // Domain-only fallback: pull the second-level label as the merchant.
  const standaloneDomain = findDomain(afterTrailing);
  if (standaloneDomain) {
    const second = standaloneDomain.split(".")[0];
    return {
      merchant_name: titleCase(second),
      category: "other",
      biller: null,
      biller_passthrough: false,
      domain: standaloneDomain,
      catalog_key: null,
      signals: {
        stripped_prefix: strippedPrefix,
        stripped_trailing: strippedTrailing,
        matched_alias: null,
        matched_domain: standaloneDomain,
        bank_fee_indicator: null,
      },
    };
  }

  // Final fallback: Title-Cased cleaned descriptor.
  return {
    merchant_name: titleCase(afterTrailing) || titleCase(original) || "Unknown",
    category: "other",
    biller: null,
    biller_passthrough: false,
    domain: null,
    catalog_key: null,
    signals: {
      stripped_prefix: strippedPrefix,
      stripped_trailing: strippedTrailing,
      matched_alias: null,
      matched_domain: null,
      bank_fee_indicator: null,
    },
  };
}

// Convenience export for the scan layer + tests.
export const CATALOG_VERSION = (catalog as { _meta?: { version?: string } })._meta
  ?.version ?? "unknown";

// ─── Subscription-grade category gate ───────────────────────────────
//
// A catalog hit proves IDENTITY (we know who this merchant is). It
// does NOT automatically prove this is a subscription-style charge —
// the curated `amazon` entry exists so 21 marketplace transactions
// group as one Amazon stream, but those transactions are retail
// purchases, not subscription fees. Same logic for food-delivery
// brands (DoorDash, Uber Eats): catalog hit by brand, but most
// individual charges are commerce, not the membership fee.
//
// "Subscription-grade" means the merchant's category implies that
// recurring charges from this brand are typically the subscription
// fee itself: streaming, software, news, cloud storage, education,
// fitness, gaming, insurance, telecom. The classifier uses this set
// to decide whether the `isCuratedMerchant` confirm path should
// unlock for a given stream.
//
// Excluded on purpose: "other" (Amazon-style retail), "food_delivery"
// (DoorDash, Uber Eats — usually purchases, not membership fees).
const SUBSCRIPTION_GRADE_CATEGORIES = new Set<string>([
  "streaming",
  "software",
  "news",
  "cloud_storage",
  "education",
  "fitness",
  "gaming",
  "insurance",
  "telecom",
]);

export function isSubscriptionGradeCategory(
  category: string | null | undefined
): boolean {
  if (!category) return false;
  return SUBSCRIPTION_GRADE_CATEGORIES.has(category);
}
