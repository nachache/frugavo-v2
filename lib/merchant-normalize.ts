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
      });
    }
  }
  return m;
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
      return { cleaned: s.slice(m[0].length).trim(), stripped: m[0].trim() };
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
} {
  // Try the full cleaned string first, then progressively shorter
  // left-anchored prefixes. This catches "netflix.com sub" → "netflix".
  const tokens = cleaned.split(/\s+/);
  for (let len = tokens.length; len >= 1; len--) {
    const candidate = tokens.slice(0, len).join(" ").toLowerCase();
    const hit = ALIAS_INDEX.get(candidate);
    if (hit) return { hit, matchedAlias: candidate };
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

  const { hit: aliasHit, matchedAlias } = lookupByAliases(afterTrailing);
  const { hit: domainHit, matchedDomain } = lookupByDomain(afterTrailing);
  const hit = aliasHit ?? domainHit;

  if (hit) {
    return {
      merchant_name: hit.display,
      category: hit.category,
      biller: hit.kind === "biller" ? hit.key : null,
      biller_passthrough: hit.kind === "biller",
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
