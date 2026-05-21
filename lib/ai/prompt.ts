import type { Frequency } from "@/lib/types/scan";

export const NORMALIZE_SYSTEM = `You normalize bank transaction descriptors to a clean merchant name and a category.

Output STRICT JSON, no prose, matching:
{ "merchant_name": string, "category": string }

merchant_name rules:
- Title case the recognizable brand only ("Netflix", "The New York Times", "Adobe Creative Cloud").
- Drop store numbers, city codes, transaction ids, payment processors (SP, SQ, PP, TST, POS).
- If unrecognizable, return the cleaned descriptor with reasonable casing.

category enum (pick exactly one): streaming, software, news, fitness, food_delivery, cloud_storage, telecom, utilities, insurance, gaming, education, other.`;

export function normalizeUser(input: {
  raw_descriptor: string;
  amount_cents: number;
  frequency: Frequency | string;
}): string {
  return `descriptor: ${input.raw_descriptor}
amount_cents: ${input.amount_cents}
frequency: ${input.frequency}`;
}

// US state abbreviations — appear in nearly every Plaid descriptor as
// the merchant's billing city/state. Stripping them lets the same brand
// from different locations collapse to one cache key.
const US_STATE_RE =
  /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/g;

// Normalize the cache key so trivial descriptor noise (transaction ids,
// store numbers, phone area codes, state codes, casing, punctuation)
// collapses to one LLM call across the entire user base. This is the
// lever that drives the 90%+ hit rate target in the spec.
//
// What we strip:
//   - 3+ digit runs (catches phone numbers, store IDs, txn IDs)
//   - US state abbreviations (CA, NY, ...)
//   - Punctuation
//   - Case
//
// What we keep:
//   - The brand stem (NETFLIX, SPOTIFY, etc.)
//   - The processor prefix when present (SP AFF*, AMZN, SQ*) — these
//     are deterministic per-merchant and help disambiguate.
export function descriptorKey(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\b\d{3,}\b/g, "#") // 3+ digit runs → placeholder
    .replace(US_STATE_RE, "")
    .replace(/[^A-Z0-9# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Safety net for parsing — Haiku may very occasionally wrap the JSON in
// markdown fences despite the system prompt. We strip fences before
// JSON.parse so a stray ``` doesn't trip the fallback chain.
export function parseNormalizeResponse(
  raw: string
): { merchant_name: string; category: string } | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (
      parsed &&
      typeof parsed.merchant_name === "string" &&
      typeof parsed.category === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
