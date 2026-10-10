import type { Hono } from "hono";
import { type JWTPayload, decodeJwt } from "jose";
import { clearShopAuthCookies } from "../clear-shop-auth-cookies.js";
import { readSession } from "../session.js";
import type { ShopIdentityAppDeps } from "../shop-identity-app-deps.js";
import { shopStorefrontPath } from "../storefront-routes.js";

async function readIdTokenClaims(
  tokenService: ShopIdentityAppDeps["tokenService"],
  sessionId: string,
): Promise<JWTPayload | null> {
  try {
    const idToken = await tokenService.readIdTokenForLogout(sessionId);
    return idToken ? decodeJwt(idToken) : null;
  } catch {
    return null;
  }
}

export function registerSessionRoutes(app: Hono, deps: ShopIdentityAppDeps): void {
  const { sessionRepository, tokenService, env } = deps;

  app.get("/", async (c) => {
    const session = await readSession(sessionRepository, c);
    return c.redirect(session?.subject ? "/me" : "/login", 302);
  });

  app.get("/me", async (c) => {
    const session = await readSession(sessionRepository, c);
    if (!session?.subject) {
      if (session?.oauth) {
        return c.json({ authenticated: false, pendingLogin: true }, 401);
      }
      clearShopAuthCookies(c);
      return c.json({ authenticated: false }, 401);
    }
    const profile = await deps.findShopProfile(session.subject);
    if (!profile || profile.disabledAt) {
      await sessionRepository.invalidate(session.id);
      await tokenService.clear(session.id);
      clearShopAuthCookies(c);
      return c.json({ authenticated: false, reason: "identity_disabled" }, 403);
    }
    const hasRefresh = await tokenService.hasStoredRefreshToken(session.id);
    const tokenUpgradeRequired = !hasRefresh;
    const claims = await readIdTokenClaims(tokenService, session.id);
    const verifiedPhone =
      claims?.phone_number_verified === true && typeof claims.phone_number === "string"
        ? claims.phone_number
        : undefined;
    const emailVerified =
      typeof claims?.email_verified === "boolean" ? claims.email_verified : undefined;
    return c.json({
      authenticated: true,
      subject: session.subject,
      profile,
      tokenUpgradeRequired,
      ...(verifiedPhone ? { verifiedPhone } : {}),
      ...(emailVerified !== undefined ? { emailVerified } : {}),
    });
  });

  /** Hands a signed-in shopper to the issuer-hosted resend page for their account email. */
  app.get("/auth/verify-email", async (c) => {
    const session = await readSession(sessionRepository, c);
    if (!session?.subject) {
      return c.redirect(shopStorefrontPath(env, "/login?returnTo=%2Faccount"), 302);
    }
    const profile = await deps.findShopProfile(session.subject);
    const target = new URL("/resend-verification", env.OIDC_ISSUER_URL);
    target.searchParams.set("client_id", env.OIDC_CLIENT_ID);
    if (profile?.email) target.searchParams.set("email", profile.email);
    return c.redirect(target.toString(), 302);
  });
}
