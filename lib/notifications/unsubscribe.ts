// One-click unsubscribe token signing.
//
// Every notification email's footer includes a link of the form:
//
//   https://frugavo.com/api/unsubscribe?u={userId}&t={alertType}&s={sig}
//
// Where `s` is an HMAC-SHA256 of `userId|alertType` keyed by
// UNSUBSCRIBE_HMAC_SECRET (or CRON_SECRET if unset). This means:
//
//   - Anyone receiving the email can unsubscribe without logging in
//     (required by CAN-SPAM and just good UX).
//   - An attacker who guesses someone's userId cannot unsubscribe
//     them without the secret.
//
// alertType can be "all" to mean global unsubscribe across every
// type. Per-type unsubs let users say "stop emailing me about
// renewal_upcoming but keep the trial alerts coming."

import crypto from "node:crypto";

const FALLBACK_SECRET =
  process.env.UNSUBSCRIBE_HMAC_SECRET ??
  process.env.CRON_SECRET ??
  "dev-only-fallback-secret-do-not-use-in-prod";

function sign(userId: string, alertType: string): string {
  return crypto
    .createHmac("sha256", FALLBACK_SECRET)
    .update(`${userId}|${alertType}`)
    .digest("base64url");
}

export function buildUnsubscribeUrl(opts: {
  baseUrl: string;
  userId: string;
  alertType: string; // "all" for global
}): string {
  const sig = sign(opts.userId, opts.alertType);
  const params = new URLSearchParams({
    u: opts.userId,
    t: opts.alertType,
    s: sig,
  });
  return `${opts.baseUrl.replace(/\/$/, "")}/api/unsubscribe?${params}`;
}

export function verifyUnsubscribeSignature(
  userId: string,
  alertType: string,
  sig: string
): boolean {
  const expected = sign(userId, alertType);
  // Constant-time compare.
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(sig)
    );
  } catch {
    return false;
  }
}
