import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export const SESSION_COOKIE_NAME = "shop_identity_session";
export const OIDC_ID_TOKEN_COOKIE_NAME = "shop_identity_id_token";

export type PendingOAuthSession = {
  state: string;
  nonce: string;
  codeVerifier: string;
};

export type ShopIdentitySession = {
  id: string;
  subject: string | null;
  sid: string | null;
  oauth: PendingOAuthSession | null;
};

export type LogoutToken = {
  jti: string;
  sid?: string | undefined;
  sub?: string | undefined;
  expiresAt: Date;
};

export interface ShopSessionRepository {
  findActive(id: string): Promise<ShopIdentitySession | null>;
  createPendingOAuth(oauth: PendingOAuthSession): Promise<string>;
  authenticate(input: { id: string; subject: string; sid: string }): Promise<void>;
  invalidate(id: string | null): Promise<void>;
  consumeLogoutToken(input: LogoutToken): Promise<"consumed" | "replay">;
}

export function readSessionId(c: Context): string | null {
  const id = getCookie(c, SESSION_COOKIE_NAME);
  return id && /^[A-Za-z0-9_-]{43}$/.test(id) ? id : null;
}

export async function readSession(
  repository: Pick<ShopSessionRepository, "findActive">,
  c: Context,
): Promise<ShopIdentitySession | null> {
  const id = readSessionId(c);
  if (!id) return null;
  return repository.findActive(id);
}

export function writeSessionCookie(
  c: Context,
  id: string,
  options?: { maxAgeSeconds?: number; secure?: boolean },
): void {
  const maxAgeSeconds = options?.maxAgeSeconds ?? 60 * 60 * 24 * 7;
  setCookie(c, SESSION_COOKIE_NAME, id, {
    httpOnly: true,
    secure: options?.secure ?? process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
}

export function readOidcIdToken(c: Context): string | null {
  const token = getCookie(c, OIDC_ID_TOKEN_COOKIE_NAME);
  if (
    !token ||
    token.length > 3_800 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  ) {
    return null;
  }
  return token;
}

export function writeOidcIdTokenCookie(c: Context, token: string, secure: boolean): void {
  setCookie(c, OIDC_ID_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearOidcIdTokenCookie(c: Context): void {
  deleteCookie(c, OIDC_ID_TOKEN_COOKIE_NAME, { path: "/" });
}
