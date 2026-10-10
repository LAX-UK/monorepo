import type { Hono } from "hono";
import { decodeJwt } from "jose";
import { clearShopAuthCookies } from "../clear-shop-auth-cookies.js";
import { readSession } from "../session.js";
import type { ShopIdentityAppDeps } from "../shop-identity-app-deps.js";

export function registerSessionRoutes(app: Hono, deps: ShopIdentityAppDeps): void {
  const { sessionRepository, tokenService } = deps;

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
    let verifiedPhone: string | undefined;
    try {
      const idToken = await tokenService.readIdTokenForLogout(session.id);
      if (!idToken) throw new Error("no_id_token");
      const claims = decodeJwt(idToken);
      if (claims.phone_number_verified === true && typeof claims.phone_number === "string") {
        verifiedPhone = claims.phone_number;
      }
    } catch {
      verifiedPhone = undefined;
    }
    return c.json({
      authenticated: true,
      subject: session.subject,
      profile,
      tokenUpgradeRequired,
      ...(verifiedPhone ? { verifiedPhone } : {}),
    });
  });
}
