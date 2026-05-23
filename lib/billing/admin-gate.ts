// Admin gate shared by billing admin surfaces.
//
// Reads FRUGAVO_ADMIN_USER_IDS (comma-separated list of Clerk user
// ids). Mirrors the existing /app/admin/models gate.

export function isBillingAdmin(clerkUserId: string): boolean {
  const allow = (process.env.FRUGAVO_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allow.includes(clerkUserId);
}
