import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";

// POST /api/plaid/link-token
//
// Returns { link_token } that the Plaid Link React component uses to
// initialize the bank-connect modal. The token is short-lived (30 min)
// and tied to the requesting Clerk user.
//
// Requested products:
//   - Transactions: the raw transaction feed (12 months on connect)
//   - Recurring Transactions: Plaid's detected recurring streams. This is
//     additional_consented, so it doesn't gate the connect flow on
//     accounts that don't support it.

export const runtime = "nodejs";

export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!plaidClient) {
    return NextResponse.json(
      { error: "Plaid is not configured on the server" },
      { status: 503 }
    );
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Frugavo",
      products: [Products.Transactions],
      additional_consented_products: [Products.RecurringTransactions],
      country_codes: [CountryCode.Us, CountryCode.Ca],
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[plaid/link-token] error:", e);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
