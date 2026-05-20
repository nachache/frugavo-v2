import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Server-side Plaid client. Reads credentials from env vars. The client is
// null if the keys aren't set — API routes check for null and return a
// 503 with a clear error rather than throwing at import time, so the build
// succeeds in environments where Plaid isn't configured (e.g. preview
// deploys, local dev without a .env.local).

const clientId = process.env.PLAID_CLIENT_ID;
const secret = process.env.PLAID_SECRET;
const envName = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;

if (!clientId || !secret) {
  // eslint-disable-next-line no-console
  console.warn(
    "[plaid] PLAID_CLIENT_ID / PLAID_SECRET missing — Plaid features disabled"
  );
}

export const plaidClient =
  clientId && secret
    ? new PlaidApi(
        new Configuration({
          basePath: PlaidEnvironments[envName] ?? PlaidEnvironments.sandbox,
          baseOptions: {
            headers: {
              "PLAID-CLIENT-ID": clientId,
              "PLAID-SECRET": secret,
              "Plaid-Version": "2020-09-14",
            },
          },
        })
      )
    : null;

export const PLAID_ENV = envName;
