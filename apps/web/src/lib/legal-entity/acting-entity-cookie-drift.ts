import { ACTING_LEGAL_ENTITY_COOKIE_NAME, decodeActingContextCookie } from "@auction/types";

export type ActingEntityCookieDrift = {
  /** Entity id resolved server-side for this request (UI + SSR API headers). */
  serverActingId: string;
  /** Entity id read from `document.cookie` (client bid / browser fetch headers). */
  cookieActingId: string | undefined;
  /** True when the cookie carries an admin impersonation session payload. */
  isImpersonation: boolean;
  /** True when a (non-impersonation) cookie is present and differs from the
   * server-resolved acting id — the state that causes
   * `not_a_member_of_legal_entity` while the switcher shows personal. */
  hasDrift: boolean;
  /** True when the client should rewrite the cookie to {@link serverActingId}
   * (cookie absent or mismatched, and not an impersonation session). */
  shouldReconcile: boolean;
};

function extractRawActingCookie(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(
    new RegExp(`(?:^|; )${ACTING_LEGAL_ENTITY_COOKIE_NAME}=([^;]*)`),
  );
  if (!match?.[1]) return undefined;
  return decodeURIComponent(match[1]).trim();
}

/** Compare SSR-resolved acting context with the browser cookie used by
 * `getClientActingLegalEntityId()` (e.g. `POST /bids`). Drift causes
 * `not_a_member_of_legal_entity` while the header switcher shows personal. */
export function detectActingEntityCookieDrift(
  serverActingId: string | null | undefined,
  cookieHeader?: string | null,
): ActingEntityCookieDrift | null {
  if (!serverActingId?.trim()) return null;
  const raw = extractRawActingCookie(cookieHeader);
  const decoded = raw ? decodeActingContextCookie(raw) : null;
  const cookieActingId = decoded?.e;
  const isImpersonation = Boolean(decoded?.i?.sid);
  const hasDrift = Boolean(cookieActingId && cookieActingId !== serverActingId && !isImpersonation);
  // Never overwrite an impersonation cookie (a plain UUID would drop the
  // server-side session payload). Otherwise heal both stale and absent cookies.
  const shouldReconcile = !isImpersonation && cookieActingId !== serverActingId;
  return {
    serverActingId,
    cookieActingId,
    isImpersonation,
    hasDrift,
    shouldReconcile,
  };
}
