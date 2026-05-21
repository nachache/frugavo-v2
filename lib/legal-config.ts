// Legal + contact metadata.
//
// Single source of truth for the business name, registered address,
// and support contact. Referenced from the marketing footer, the
// privacy policy, the terms of service, and any outbound email
// signature so we never have to grep for "hello@frugavo.com" when
// these change.
//
// REPLACE THE PLACEHOLDER VALUES BEFORE LAUNCH. Plaid's production
// review requires a real incorporated entity with a verifiable
// registered address, and a real support contact path that's
// distinct from the marketing-style hello@ inbox.

export type LegalConfig = {
  /** Full legal entity name. */
  legalName: string;
  /** Trading / brand name shown to users. */
  brandName: string;
  /** Multi-line registered address. */
  address: {
    line1: string;
    line2?: string;
    city: string;
    region: string;       // state / province
    postalCode: string;
    country: string;      // ISO country name
  } | null;
  /** Customer-facing email. Replies should be monitored. */
  supportEmail: string;
  /** Privacy / data-subject-rights inbox. May be the same as support. */
  privacyEmail: string;
  /** Security / vulnerability disclosure inbox. */
  securityEmail: string;
  /** Optional support phone number. Leave null until we offer one. */
  supportPhone: string | null;
};

// Placeholders. These will surface as "[UPDATE BEFORE LAUNCH]" in the
// footer and privacy page so we can't accidentally ship to production
// with them in place.
export const LEGAL: LegalConfig = {
  legalName: "[UPDATE BEFORE LAUNCH] Frugavo, Inc.",
  brandName: "Frugavo",
  address: null,
  supportEmail: "hello@frugavo.com",
  privacyEmail: "privacy@frugavo.com",
  securityEmail: "security@frugavo.com",
  supportPhone: null,
};

// Helper used by components that should render a placeholder badge when
// the config still has its default values. Lets us visually warn
// ourselves at every render until we update.
export function isLegalConfigComplete(): boolean {
  return (
    !LEGAL.legalName.startsWith("[UPDATE") &&
    LEGAL.address !== null
  );
}

// Render-ready single-line address. Returns null when no address is
// configured so callers can hide the line entirely rather than ship
// an empty string.
export function formatAddressLine(): string | null {
  if (!LEGAL.address) return null;
  const a = LEGAL.address;
  const parts = [a.line1, a.line2, `${a.city}, ${a.region} ${a.postalCode}`, a.country].filter(
    Boolean
  );
  return parts.join(" · ");
}
