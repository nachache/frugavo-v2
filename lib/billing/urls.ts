// Centralized app-URL resolution for billing redirects. Mirrors the
// helper in lib/notifications/dispatch.ts so success/cancel URLs and
// email links resolve the same way.
//
// Precedence (first defined wins):
//   APP_URL                — explicit override (Netlify env)
//   NEXT_PUBLIC_APP_URL    — also explicit, exposed to client
//   URL                    — Netlify provides this automatically
//   fallback               — https://frugavo.com

export function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.URL ??
    "https://frugavo.com"
  );
}

// Stripe substitutes {CHECKOUT_SESSION_ID} on redirect, so the
// success page can self-identify and poll /api/billing/check.
export function checkoutSuccessUrl(): string {
  return `${appUrl().replace(/\/$/, "")}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`;
}

export function checkoutCancelUrl(): string {
  return `${appUrl().replace(/\/$/, "")}/app`;
}

export function portalReturnUrl(): string {
  return `${appUrl().replace(/\/$/, "")}/app/settings`;
}
