import type { Context } from "hono";
import type { ShopIdentityTokenService } from "./application/shop-identity-token.service.js";
import { clearShopAuthCookies } from "./clear-shop-auth-cookies.js";
import { ShopIdentityReauthRequiredError } from "./errors/shop-identity-reauth.error.js";
import {
  type ShopSessionRepository,
  clearOidcIdTokenCookie,
  clearSessionCookie,
  readOidcIdToken,
  readSession,
  readSessionId,
  writeSessionCookie,
} from "./session.js";

export type CommerceGuestContext = {
  kind: "guest";
  sessionId: string;
  idToken: null;
};

export type CommerceAuthenticatedContext = {
  kind: "authenticated";
  sessionId: string;
  idToken: string;
  subject: string;
};

export type CommerceContext = CommerceGuestContext | CommerceAuthenticatedContext;

export async function resolveGuestCommerceContext(
  c: Context,
  deps: { sessionRepository: ShopSessionRepository; secureCookies: boolean },
): Promise<CommerceGuestContext> {
  let sessionId = readSessionId(c);
  if (sessionId) {
    const active = await deps.sessionRepository.findActive(sessionId);
    if (!active) {
      clearSessionCookie(c);
      clearOidcIdTokenCookie(c);
      sessionId = null;
    } else if (active.subject) {
      clearOidcIdTokenCookie(c);
    }
  }
  if (!sessionId) {
    sessionId = await deps.sessionRepository.createGuestSession();
    writeSessionCookie(c, sessionId, { secure: deps.secureCookies });
  }
  return { kind: "guest", sessionId, idToken: null };
}

export async function resolveAuthenticatedCommerceContext(
  c: Context,
  deps: { sessionRepository: ShopSessionRepository; tokenService: ShopIdentityTokenService },
): Promise<CommerceAuthenticatedContext | null> {
  const session = await readSession(deps.sessionRepository, c);
  const legacyIdToken = readOidcIdToken(c);
  if (!session?.subject) {
    clearShopAuthCookies(c);
    return null;
  }
  try {
    const idToken = await deps.tokenService.resolveIdToken(session.id, { legacyIdToken });
    return {
      kind: "authenticated",
      sessionId: session.id,
      idToken,
      subject: session.subject,
    };
  } catch (error) {
    if (error instanceof ShopIdentityReauthRequiredError) {
      clearShopAuthCookies(c);
      await deps.tokenService.clear(session.id);
      throw error;
    }
    throw error;
  }
}
