import {
  ACTING_LEGAL_ENTITY_COOKIE_NAME,
  decodeActingContextCookie,
  isUuidString,
} from "@auction/types";
import type { LegalEntitySummary } from "@auction/types";

export const ACTING_LEGAL_ENTITY_COOKIE = ACTING_LEGAL_ENTITY_COOKIE_NAME;

/** Header name used by the API to validate acting context. */
export const X_LEGAL_ENTITY_ID_HEADER = "x-legal-entity-id";

/** Re-export of the canonical {@link LegalEntitySummary} so call sites can
 * import a single type without importing from `@auction/types` directly.
 */
export type ActingLegalEntitySummary = LegalEntitySummary;

/** Get the acting legal entity ID from `document.cookie` (client-side). */
export function getClientActingLegalEntityId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return parseActingLegalEntityId(document.cookie);
}

/** Parse a cookie header / `document.cookie` for the acting entity id. */
export function parseActingLegalEntityId(
  cookieHeader: string | undefined | null,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${ACTING_LEGAL_ENTITY_COOKIE}=([^;]*)`));
  if (!match?.[1]) return undefined;
  const raw = decodeURIComponent(match[1]).trim();
  const decoded = decodeActingContextCookie(raw);
  if (decoded) return decoded.e;
  return isUuidString(raw) ? raw : undefined;
}

/** Set or clear the acting legal entity cookie. We expire after 1 year and
 * scope the cookie to `path=/` with `SameSite=Lax`. Cross-subdomain support
 * (`.lax.bid`) is opt-in via `NEXT_PUBLIC_COOKIE_DOMAIN`.
 */
export function setClientActingLegalEntityId(legalEntityId: string | null): void {
  if (typeof document === "undefined") return;
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  const expires = legalEntityId
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
    : "Thu, 01 Jan 1970 00:00:00 GMT";
  const value = legalEntityId ? encodeURIComponent(legalEntityId) : "";
  const domainPart = domain ? `; domain=${domain}` : "";
  document.cookie = `${ACTING_LEGAL_ENTITY_COOKIE}=${value}; path=/; expires=${expires}; SameSite=Lax${domainPart}`;
}

export function clearClientActingLegalEntityId(): void {
  setClientActingLegalEntityId(null);
}
