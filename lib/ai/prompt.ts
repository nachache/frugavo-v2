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

// Normalize the cache key so trivial descriptor noise (transaction ids,
// store numbers, casing, punctuation) collapses to one LLM call across
// the entire user base. This is the lever that drives the 90%+ hit rate
// target in the spec.
export function descriptorKey(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\b\d{4,}\b/g, "#") // 4+ digit runs → placeholder
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
