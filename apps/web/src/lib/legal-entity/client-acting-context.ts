import { ACTING_LEGAL_ENTITY_COOKIE_NAME, decodeActingContextCookie } from "@auction/types";
import type { LegalEntitySummary } from "@auction/types";

export const ACTING_LEGAL_ENTITY_COOKIE = ACTING_LEGAL_ENTITY_COOKIE_NAME;

/** Header name used by the API to validate acting context. */
export { X_LEGAL_ENTITY_ID_HEADER } from "@auction/http-headers";

/** Re-export of the canonical {@link LegalEntitySummary} so call sites can
 * import a single type without importing from `@auction/types` directly.
 */
export type ActingLegalEntitySummary = LegalEntitySummary;

/** Get the acting legal entity ID from `document.cookie` (client-side). */
export function getClientActingLegalEntityId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return parseActingLegalEntityId(document.cookie);
}

/** What the account cookie says: the account it names, and the staff view session it carries. */
export type ActingCookie = {
  accountId: string;
  /** A staff "view as client" session id; `null` for an ordinary choice. */
  viewSessionId: string | null;
};

function urlDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The one reader of the account cookie's value (a bare account id, or the encoded form with a
 * staff view). It URL-decodes first, whether the value came from a request header or from
 * `document.cookie`, and returns `null` for an empty or unreadable value.
 */
export function readActingCookie(raw: string | undefined | null): ActingCookie | null {
  if (!raw) return null;
  const decoded = decodeActingContextCookie(urlDecode(raw).trim());
  return decoded ? { accountId: decoded.e, viewSessionId: decoded.i?.sid ?? null } : null;
}

/** Parse a cookie header / `document.cookie` for the acting entity id. */
export function parseActingLegalEntityId(
  cookieHeader: string | undefined | null,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${ACTING_LEGAL_ENTITY_COOKIE}=([^;]*)`));
  return readActingCookie(match?.[1])?.accountId;
}

const EXPIRED = "Thu, 01 Jan 1970 00:00:00 GMT";

/**
 * Set or clear the acting legal entity cookie. It is host-only (no `Domain`), so it never
 * reaches sibling subdomains such as the ATG White Label on `auctions.lax.bid`; every reader is
 * on the Bid origin. It expires after a year, with `path=/` and `SameSite=Lax`.
 */
export function setClientActingLegalEntityId(legalEntityId: string | null): void {
  if (typeof document === "undefined") return;
  expireSharedActingCookie();
  const expires = legalEntityId
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
    : EXPIRED;
  const value = legalEntityId ? encodeURIComponent(legalEntityId) : "";
  document.cookie = `${ACTING_LEGAL_ENTITY_COOKIE}=${value}; path=/; expires=${expires}; SameSite=Lax`;
}

/**
 * Removes the copy older deployments set with `Domain=<NEXT_PUBLIC_COOKIE_DOMAIN>`. Left in
 * place it would be sent beside the host-only cookie, and as the older cookie it is listed
 * first and wins on the server. Only a cookie written with the same `Domain` can be removed, and
 * `document.cookie` is the one place a response can expire it without replacing the host-only
 * cookie of the same name.
 */
export function expireSharedActingCookie(): void {
  if (typeof document === "undefined") return;
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim();
  if (!domain) return;
  document.cookie = `${ACTING_LEGAL_ENTITY_COOKIE}=; path=/; expires=${EXPIRED}; SameSite=Lax; domain=${domain}`;
}

export function clearClientActingLegalEntityId(): void {
  setClientActingLegalEntityId(null);
}
