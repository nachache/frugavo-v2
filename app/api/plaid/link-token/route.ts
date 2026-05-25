import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { appUrl } from "@/lib/billing/urls";

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
//
// Two parameters that are critical in production but optional in sandbox:
//
//   webhook       — Plaid's only channel for telling us about new
//                   transactions, item errors, and recurring-transactions
//                   refreshes. Without it, /api/plaid/webhook never
//                   receives anything in prod and we'd be stuck polling.
//
//   redirect_uri  — Required for OAuth banks (Chase, Capital One, Wells
//                   Fargo, most Canadian banks). The bank's auth page
//                   redirects back to this URL with a state token; Plaid
//                   Link reads it on resume. Must be whitelisted in the
//                   Plaid Dashboard under Team Settings → API → Allowed
//                   redirect URIs *for each environment* (sandbox + prod).
//                   We point at /app/connect which already hosts Link.

export const runtime = "nodejs";

function plaidWebhookUrl(): string {
  return `${appUrl().replace(/\/$/, "")}/api/plaid/webhook`;
}

function plaidRedirectUri(): string {
  return `${appUrl().replace(/\/$/, "")}/app/connect`;
}

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
      webhook: plaidWebhookUrl(),
      redirect_uri: plaidRedirectUri(),
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
