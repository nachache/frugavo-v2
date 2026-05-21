import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Crypto module reads the env var at import time, so we need to set
// before importing inside each test. Vitest reloads modules between
// resets via vi.resetModules().
import { vi } from "vitest";

const VALID_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 hex = 32 bytes

let encryptToken: (s: string) => string;
let decryptToken: (s: string) => string;
let isEncryptionConfigured: () => boolean;

beforeEach(async () => {
  vi.resetModules();
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.from(VALID_KEY, "hex").toString(
    "base64"
  );
  const mod = await import("@/lib/crypto");
  encryptToken = mod.encryptToken;
  decryptToken = mod.decryptToken;
  isEncryptionConfigured = mod.isEncryptionConfigured;
});

afterEach(() => {
  delete process.env.TOKEN_ENCRYPTION_KEY;
});

describe("token encryption", () => {
  it("round-trips a plaintext token through encrypt + decrypt", () => {
    const original = "access-sandbox-abc123-def456-ghi789";
    const encrypted = encryptToken(original);
    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain(original);
    expect(decryptToken(encrypted)).toBe(original);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    const a = encryptToken("same-input");
    const b = encryptToken("same-input");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(decryptToken(b));
  });

  it("passes legacy plaintext tokens through unchanged", () => {
    expect(decryptToken("access-sandbox-legacy")).toBe(
      "access-sandbox-legacy"
    );
  });

  it("passes REVOKED sentinel through unchanged", () => {
    expect(decryptToken("REVOKED")).toBe("REVOKED");
  });

  it("isEncryptionConfigured reflects env presence", () => {
    expect(isEncryptionConfigured()).toBe(true);
  });

  it("rejects tampering — flipping a byte fails the auth tag", () => {
    const enc = encryptToken("sensitive");
    // Flip a byte in the base64 ciphertext.
    const raw = Buffer.from(enc.slice(3), "base64");
    raw[raw.length - 1] ^= 0xff;
    const tampered = "v1:" + raw.toString("base64");
    expect(() => decryptToken(tampered)).toThrow();
  });
});
