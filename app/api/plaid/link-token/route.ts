import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";

// POST /api/plaid/link-token
//
// Returns { link_token } that the Plaid Link React component uses to
// initialize the bank-connect modal.
//
// We only request `transactions` as a product. The recurring-transactions
// feature is called via /transactions/recurring/get after the Item is
// created — it doesn't need to be requested at link creation, and asking
// for it as additional_consented_products often fails in sandbox unless
// the account has been explicitly enabled for that product.

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
      country_codes: [CountryCode.Us, CountryCode.Ca],
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (e: unknown) {
    // Plaid errors come back wrapped — the useful detail is in
    // err.response.data, not in err.message. Surface it both in logs and
    // in the JSON response so we can debug without round-tripping through
    // Netlify function logs every time.
    const err = e as { response?: { data?: unknown }; message?: string };
    const plaidDetail = err.response?.data ?? err.message ?? "unknown error";
    // eslint-disable-next-line no-console
    console.error("[plaid/link-token] error:", plaidDetail);
    return NextResponse.json(
      {
        error: "Failed to create link token",
        plaid: plaidDetail,
      },
      { status: 500 }
    );
  }
}
