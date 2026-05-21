import { createHash } from "crypto";

// Stable subscription identity.
//
// The old identity was (user_id, plaid_stream_id). Plaid sometimes
// rotates stream_id mid-stream when a recurring charge transitions
// between EARLY_DETECTION / MATURE / TOMBSTONED, which orphaned our
// row and dropped the user's keep/cancel decision.
//
// The new identity is a SHA-256 hash of (user_id, normalized_merchant_key).
// Same merchant on the same account always hashes to the same key,
// regardless of what Plaid does with stream_id.
//
// Hashing rather than storing the raw merchant_key as the unique
// constraint key keeps the column fixed-width and indexable, and lets
// us evolve the merchant_key derivation rule in the future without
// migrating the unique constraint.

export function subscriptionKey(
  userId: string,
  merchantKey: string
): string {
  const normalized = merchantKey.trim().toLowerCase();
  return createHash("sha256")
    .update(`${userId}:${normalized}`)
    .digest("hex");
}
