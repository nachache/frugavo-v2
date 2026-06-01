// Admin gate shared by billing admin surfaces.
//
// Primary path: FRUGAVO_ADMIN_USER_IDS (comma-separated list of Clerk
// user ids) — the production-correct way to manage operator access.
//
// Fallback path: a hardcoded founder allowlist by EMAIL. This exists
// so the operator can always reach /app/admin/* even when the env
// var hasn't been set yet (e.g., immediately after creating a fresh
// Clerk account for a new device or a new email). The list is tiny
// on purpose — only the founder. Remove once env config is the
// source of truth across all environments.
const HARDCODED_FOUNDER_EMAILS = new Set([
  "nabil.achache@gmail.com",
  "hello@frugavo.com",
]);

export function isBillingAdmin(
  clerkUserId: string,
  email?: string | null
): boolean {
  // Env-var allowlist — the primary mechanism.
  const allow = (process.env.FRUGAVO_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.includes(clerkUserId)) return true;

  // Founder email fallback — see comment above for why this exists.
  if (email && HARDCODED_FOUNDER_EMAILS.has(email.toLowerCase().trim())) {
    return true;
  }

  return false;
}
