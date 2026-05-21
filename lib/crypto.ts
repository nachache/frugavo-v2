import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM encryption for Plaid access tokens at rest.
//
// Storage format: "v1:" + base64(iv || authTag || ciphertext)
//   iv:        12 bytes (GCM standard)
//   authTag:   16 bytes
//   ciphertext: variable
//
// Tokens persisted before this rolled out are stored as plaintext and
// don't have the "v1:" prefix. decryptToken handles both — if the prefix
// is missing we return the input unchanged. This lets us roll out the
// change without a backfill migration; the first re-scan after deploy
// re-writes the token in encrypted form via the upsert path.
//
// Key requirements: TOKEN_ENCRYPTION_KEY env var must be a 32-byte
// base64-encoded random key. Generate one with:
//   openssl rand -base64 32

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    return null;
  }
  if (buf.length !== 32) return null;
  return buf;
}

const KEY = loadKey();

if (!KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "[crypto] TOKEN_ENCRYPTION_KEY missing or wrong length — Plaid tokens will be stored unencrypted"
  );
}

export function encryptToken(plaintext: string): string {
  if (!KEY) return plaintext; // degrade gracefully; warn-only on missing key
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${Buffer.concat([iv, tag, enc]).toString("base64")}`;
}

export function decryptToken(stored: string): string {
  if (!stored) return stored;
  if (stored === "REVOKED") return stored;
  if (!stored.startsWith("v1:")) {
    // Legacy plaintext token — return as-is and the next write will
    // upgrade it. Don't warn on every call; the migration is implicit.
    return stored;
  }
  if (!KEY) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY missing — cannot decrypt v1 token"
    );
  }
  const buf = Buffer.from(stored.slice(3), "base64");
  if (buf.length <= IV_LEN + TAG_LEN) {
    throw new Error("invalid encrypted token format");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function isEncryptionConfigured(): boolean {
  return KEY !== null;
}
