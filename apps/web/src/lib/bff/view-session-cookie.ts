import { ACTING_LEGAL_ENTITY_COOKIE_NAME, decodeActingContextCookie } from "@auction/types";

/** Characters of a base64url value; a structured acting cookie never needs more. */
const BASE64URL_VALUE = /^[A-Za-z0-9_-]{1,512}$/;

/**
 * The `Cookie` header for one acting-cookie value: just that cookie when it is a structured view
 * session, otherwise `null`. For callers that already chose which duplicate to use.
 */
export function viewSessionCookieFromValue(value: string | null | undefined): string | null {
  if (!value || !BASE64URL_VALUE.test(value)) return null;
  if (!decodeActingContextCookie(value)?.i?.sid) return null;
  return `${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${value}`;
}

/**
 * The one cookie the API reads besides the bearer token: the staff "view as client" session. The
 * API validates the session id server side (staff role, session row, expiry, target entity) on
 * every request; the web tier only carries it across, and only that cookie, by exact name.
 *
 * Returns a `Cookie` header value holding just that cookie, or `null` when the request has none
 * or it is not a structured view session (the plain account choice is sent as a header instead).
 */
export function viewSessionCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== ACTING_LEGAL_ENTITY_COOKIE_NAME) continue;
    return viewSessionCookieFromValue(pair.slice(separator + 1).trim());
  }
  return null;
}
