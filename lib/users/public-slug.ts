// Public-slug helper.
//
// Each user gets a random, stable, opaque slug used in the public
// share URL https://frugavo.com/u/<slug>. The slug is:
//   - Generated lazily (first time the user clicks Share)
//   - Never derived from PII (email/name/etc.) — leaks nothing
//   - 10 lowercase base32 chars (10^15 keys, collision-free in
//     practice for our scale)
//   - Globally unique via the DB unique constraint

import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

// Base32 alphabet excluding ambiguous chars (no 0/o/1/l).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SLUG_LEN = 10;

function randomSlug(): string {
  const bytes = crypto.randomBytes(SLUG_LEN);
  let out = "";
  for (let i = 0; i < SLUG_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

// Return the user's slug, generating + persisting one on first call.
// Idempotent — concurrent calls converge on the same slug via the
// unique constraint.
export async function getOrCreatePublicSlug(
  clerkUserId: string
): Promise<string | null> {
  if (!supabaseAdmin) return null;

  // Fast path: existing slug.
  const { data: existing } = await supabaseAdmin
    .from("app_users")
    .select("public_slug")
    .eq("id", clerkUserId)
    .maybeSingle();

  if (existing?.public_slug) return existing.public_slug;

  // Generate + persist. Retry on the (vanishingly rare) collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomSlug();
    const { error } = await supabaseAdmin
      .from("app_users")
      .update({ public_slug: candidate })
      .eq("id", clerkUserId)
      .is("public_slug", null);

    if (!error) {
      // Re-read to confirm we won (a concurrent caller may have set
      // a different slug first — Postgres unique handles that).
      const { data: after } = await supabaseAdmin
        .from("app_users")
        .select("public_slug")
        .eq("id", clerkUserId)
        .maybeSingle();
      if (after?.public_slug) return after.public_slug;
    }
    // Collision (vanishingly rare) — try a different slug.
  }
  return null;
}

// Reverse lookup — used by the public /u/[slug] page.
export async function findUserBySlug(slug: string): Promise<{
  clerk_user_id: string;
} | null> {
  if (!supabaseAdmin) return null;
  // Validate format defensively — never query with arbitrary user input.
  if (!/^[a-z2-9]{6,32}$/.test(slug)) return null;

  const { data } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!data) return null;
  return { clerk_user_id: data.id };
}
