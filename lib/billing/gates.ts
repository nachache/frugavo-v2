// Server-side entitlement gates.
//
// Two flavors:
//   - userHasAccess(userId): boolean wrapper around hasAccess() for
//     conditional UI ("show this card?")
//   - assertEntitled({ user, feature }): returns NextResponse with
//     402 Payment Required when no access; for use at the top of
//     API route handlers
//
// We use HTTP 402 (Payment Required) rather than 403 (Forbidden) so
// the client can distinguish "you're not allowed" from "you need to
// upgrade." Lets the UI show an "Activate Protection" CTA on the
// gated card instead of a generic permission error.

import { NextResponse } from "next/server";
import { hasAccess } from "@/lib/billing/entitlements";

export async function userHasAccess(
  clerkUserId: string,
  feature: string = "peace_of_mind"
): Promise<boolean> {
  return hasAccess(clerkUserId, feature);
}

// Use at the top of API route handlers that gate behind paid plan.
// Returns null if entitled; returns a 402 NextResponse if not.
//
// Pattern:
//   const gate = await assertEntitled({ clerkUserId: user.id });
//   if (gate) return gate;
//   // ... rest of handler
export async function assertEntitled(args: {
  clerkUserId: string;
  feature?: string;
}): Promise<NextResponse | null> {
  const ok = await hasAccess(args.clerkUserId, args.feature ?? "peace_of_mind");
  if (ok) return null;
  return NextResponse.json(
    {
      error: "payment_required",
      feature: args.feature ?? "peace_of_mind",
      activate_url: "/app",
    },
    { status: 402 }
  );
}
