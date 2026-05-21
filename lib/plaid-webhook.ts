import { createHash, timingSafeEqual } from "crypto";
import * as jose from "jose";
import { plaidClient } from "./plaid";
import { cacheGet, cacheSet, cacheKey } from "./cache";

// Full Plaid webhook signature verification.
//
// Plaid signs each webhook delivery with a JWT (JWS) using ES256. The
// verification flow:
//
//   1. Parse the header to extract `kid` (the signing key id).
//   2. Fetch the matching public key from /webhook_verification_key/get
//      and cache it for 24h.
//   3. Verify the JWT signature with that key (ES256, P-256, SHA-256).
//   4. Hash the raw request body and compare against the JWT's
//      `request_body_sha256` claim — protects against body tampering.
//   5. Check `iat` is within 5 minutes — protects against replay.
//
// All steps must pass for the webhook to be trusted.

const KEY_CACHE_SECONDS = 60 * 60 * 24;
const MAX_AGE_SECONDS = 5 * 60;

type PlaidVerificationKey = {
  alg: string;
  created_at: number;
  crv: string;
  expired_at: number | null;
  kid: string;
  kty: string;
  use: string;
  x: string;
  y: string;
};

export async function verifyPlaidWebhookJwt(
  rawBody: string,
  jwt: string
): Promise<boolean> {
  if (!jwt || !plaidClient) return false;

  // 1. Header → kid.
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;

  let kid: string;
  try {
    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf-8")
    ) as { kid?: string; alg?: string };
    if (!header.kid || header.alg !== "ES256") return false;
    kid = header.kid;
  } catch {
    return false;
  }

  // 2. Public key — Redis-cached for 24h.
  const cacheK = cacheKey.webhookKey(kid);
  let key = await cacheGet<PlaidVerificationKey>(cacheK);

  if (!key) {
    try {
      const res = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
      key = res.data.key as unknown as PlaidVerificationKey;
      // Don't cache keys that have already been rotated out by Plaid.
      if (!key.expired_at || key.expired_at * 1000 > Date.now()) {
        await cacheSet(cacheK, key, KEY_CACHE_SECONDS);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[webhook] verification key fetch failed", e);
      return false;
    }
  }

  if (!key) return false;
  if (key.expired_at && key.expired_at * 1000 < Date.now()) return false;

  // 3. JWT signature.
  let payload: jose.JWTPayload;
  try {
    const importedKey = await jose.importJWK(
      {
        kty: key.kty,
        crv: key.crv,
        x: key.x,
        y: key.y,
        alg: key.alg,
        use: key.use,
      } as jose.JWK,
      "ES256"
    );
    const result = await jose.jwtVerify(jwt, importedKey, {
      algorithms: ["ES256"],
    });
    payload = result.payload;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[webhook] JWT verify failed", e);
    return false;
  }

  // 4. Body integrity — sha256 hex match.
  const expectedHash = createHash("sha256").update(rawBody).digest("hex");
  const claim = (payload as { request_body_sha256?: string })
    .request_body_sha256;
  if (!claim) return false;
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(claim, "hex");
  if (expected.length !== actual.length) return false;
  if (!timingSafeEqual(expected, actual)) return false;

  // 5. Replay window — JWT must not be older than 5 minutes.
  if (typeof payload.iat === "number") {
    const ageSec = Math.floor(Date.now() / 1000) - payload.iat;
    if (ageSec > MAX_AGE_SECONDS) return false;
  } else {
    return false;
  }

  return true;
}
