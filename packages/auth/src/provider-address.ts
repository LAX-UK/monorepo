/**
 * The address a Google or Apple account reported when it was linked, and whether Apple hid it
 * behind a private relay (SM3, SM8). Read from the ID token the provider returned on the
 * authorisation-code exchange, which the issuer received straight from the provider over TLS, so
 * its claims need no signature check here (OpenID Connect Core 3.1.3.7). Nothing in it can change
 * the LAX Account's own email: it is only shown to the person, beside the row.
 */
export type ProviderAddress = {
  /** The address as the provider reported it, lower-cased; null when it reported none. */
  email: string | null;
  /** The provider gave a private relay address instead of the person's own. */
  hidden: boolean;
};

const RELAY_DOMAIN = "privaterelay.appleid.com";
/** The longest address kept; a provider that sends more is treated as sending none. */
const MAX_ADDRESS_LENGTH = 254;

type Claims = { email?: unknown; is_private_email?: unknown };

function readClaims(idToken: string): Claims | null {
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Claims)
      : null;
  } catch {
    return null;
  }
}

/** Apple sends `is_private_email` as a boolean or as the string "true". */
function isTrue(value: unknown): boolean {
  return value === true || value === "true";
}

export function readProviderAddress(idToken: string | null | undefined): ProviderAddress {
  const claims = idToken ? readClaims(idToken) : null;
  const raw = typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : "";
  const email =
    raw.length > 0 && raw.length <= MAX_ADDRESS_LENGTH && raw.includes("@") ? raw : null;
  const hidden =
    email !== null && (isTrue(claims?.is_private_email) || email.endsWith(`@${RELAY_DOMAIN}`));
  return { email, hidden };
}
