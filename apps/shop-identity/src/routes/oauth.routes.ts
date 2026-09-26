import { randomBytes } from "node:crypto";
import { type OidcAuthorizePrompt, classifySilentCallback } from "@auction/identity-rp";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type {
  CompleteOAuthCallbackInput,
  CompleteOAuthCallbackResult,
} from "../application/complete-oauth-callback.handler.js";
import { refreshExpiresAtFromNow } from "../application/token-expiry.js";
import { clearBasketToken } from "../basket-cookie.js";
import { clearShopAuthCookies } from "../clear-shop-auth-cookies.js";
import { assertStorefrontOrigin, clearCommerceCsrfCookie } from "../commerce-csrf.js";
import { clearResourceTokenCacheForSession } from "../infrastructure/shop-api.client.js";
import { buildAuthorizeUrl, buildEndSessionUrl, generateOAuthLoginParams } from "../oidc.js";
import {
  SHOP_TOKEN_UPGRADE_COOKIE_NAME,
  clearOidcIdTokenCookie,
  readSession,
  readSessionId,
  writeSessionCookie,
} from "../session.js";
import type { ShopIdentityAppDeps } from "../shop-identity-app-deps.js";
import {
  SHOP_SILENT_SSO_COOKIE_NAMES,
  clearShopSilentProbe,
  clearShopSilentSuppressed,
  markShopSilentProbe,
  markShopSilentQuiet,
  markShopSilentSuppressed,
} from "../silent-sign-in-cookies.js";
import { shopStorefrontBaseUrl, shopStorefrontPath } from "../storefront-routes.js";

type OAuthRoutesDeps = Pick<
  ShopIdentityAppDeps,
  "env" | "sessionRepository" | "discovery" | "secureCookies" | "tokenService"
> & {
  completeOAuthCallback(input: CompleteOAuthCallbackInput): Promise<CompleteOAuthCallbackResult>;
};

export function registerOAuthRoutes(app: Hono, deps: OAuthRoutesDeps): void {
  const { env, sessionRepository, discovery, secureCookies, tokenService } = deps;

  async function startShopAuthorization(
    c: Context,
    options?: { prompt?: OidcAuthorizePrompt; requireAuthenticatedSession?: boolean },
  ) {
    const returnTo = c.req.query("returnTo");
    if (typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      setCookie(c, "shop_return_to", returnTo, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 10,
      });
    }
    const oauth = generateOAuthLoginParams();
    if (options?.requireAuthenticatedSession) {
      const sessionId = readSessionId(c);
      const session = sessionId ? await sessionRepository.findActive(sessionId) : null;
      if (!session?.subject || !sessionId) {
        return c.redirect(shopStorefrontPath(env, "/login"), 302);
      }
      const attached = await sessionRepository.attachPendingOAuthToAuthenticatedSession(
        sessionId,
        oauth,
      );
      if (!attached) {
        return c.redirect(shopStorefrontPath(env, "/login"), 302);
      }
    } else {
      const sessionId = await sessionRepository.createPendingOAuth(oauth);
      writeSessionCookie(c, sessionId, {
        maxAgeSeconds: 60 * 10,
        secure: secureCookies,
      });
    }
    return c.redirect(
      buildAuthorizeUrl({
        discovery,
        clientId: env.OIDC_CLIENT_ID,
        redirectUri: env.OIDC_REDIRECT_URI,
        params: oauth,
        ...(options?.prompt ? { prompt: options.prompt } : {}),
      }),
      302,
    );
  }

  app.get("/login", (c) => {
    clearShopSilentSuppressed(c);
    return startShopAuthorization(c);
  });
  app.get("/register", (c) => {
    clearShopSilentSuppressed(c);
    return startShopAuthorization(c);
  });

  app.get("/auth/sso-probe", (c) => {
    markShopSilentProbe(c, secureCookies);
    return startShopAuthorization(c, { prompt: "none" });
  });

  app.get("/auth/upgrade", async (c) => {
    if (getCookie(c, SHOP_TOKEN_UPGRADE_COOKIE_NAME)) {
      return c.redirect(shopStorefrontPath(env, "/login"), 302);
    }
    setCookie(c, SHOP_TOKEN_UPGRADE_COOKIE_NAME, "1", {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 5,
    });
    return startShopAuthorization(c, { prompt: "none", requireAuthenticatedSession: true });
  });

  app.get("/auth/callback", async (c) => {
    const session = await readSession(sessionRepository, c);
    const oauthError = c.req.query("error") ?? null;
    const probeActive = Boolean(getCookie(c, SHOP_SILENT_SSO_COOKIE_NAMES.probe));
    const silentCallback = classifySilentCallback(oauthError);
    if (probeActive && silentCallback.kind !== "success") {
      deleteCookie(c, SHOP_TOKEN_UPGRADE_COOKIE_NAME, { path: "/" });
      if (session?.id) {
        await tokenService.clear(session.id);
      }
      clearShopAuthCookies(c);
      markShopSilentQuiet(c, secureCookies);
      const returnTo = getCookie(c, "shop_return_to");
      deleteCookie(c, "shop_return_to", { path: "/" });
      const safeReturnTo =
        typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
          ? returnTo
          : "/";
      return c.redirect(shopStorefrontPath(env, safeReturnTo), 302);
    }
    if (
      oauthError === "login_required" ||
      oauthError === "interaction_required" ||
      oauthError === "consent_required"
    ) {
      deleteCookie(c, SHOP_TOKEN_UPGRADE_COOKIE_NAME, { path: "/" });
      if (session?.id) {
        await tokenService.clear(session.id);
      }
      clearShopAuthCookies(c);
      return c.redirect(shopStorefrontPath(env, "/login"), 302);
    }
    const result = await deps.completeOAuthCallback({
      session,
      receivedState: c.req.query("state") ?? null,
      code: c.req.query("code") ?? null,
      oauthError,
    });
    deleteCookie(c, SHOP_TOKEN_UPGRADE_COOKIE_NAME, { path: "/" });
    if (probeActive) {
      clearShopSilentProbe(c);
    }
    if (result.kind === "session_expired") {
      if (probeActive) {
        markShopSilentQuiet(c, secureCookies);
        const returnTo = getCookie(c, "shop_return_to");
        deleteCookie(c, "shop_return_to", { path: "/" });
        const safeReturnTo =
          typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
            ? returnTo
            : "/";
        return c.redirect(shopStorefrontPath(env, safeReturnTo), 302);
      }
      return c.redirect(shopStorefrontPath(env, "/session-expired"), 302);
    }
    if (result.kind === "error") {
      return c.redirect(
        shopStorefrontPath(env, `/auth/callback?error=${encodeURIComponent(result.code)}`),
        302,
      );
    }
    if (result.kind === "disabled") {
      clearShopAuthCookies(c);
      return c.redirect(shopStorefrontPath(env, "/account/disabled"), 302);
    }
    writeSessionCookie(c, result.sessionId, { secure: secureCookies });
    clearShopSilentSuppressed(c);
    clearOidcIdTokenCookie(c);
    await tokenService.persist(result.sessionId, {
      idToken: result.idToken,
      refreshToken: result.refreshToken,
      refreshExpiresAt: refreshExpiresAtFromNow(Date.now()),
    });
    const returnTo = getCookie(c, "shop_return_to");
    deleteCookie(c, "shop_return_to", { path: "/" });
    const safeReturnTo =
      typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : null;
    const destination =
      probeActive && safeReturnTo
        ? safeReturnTo
        : safeReturnTo
          ? `/account?returnTo=${encodeURIComponent(safeReturnTo)}`
          : "/account";
    return c.redirect(shopStorefrontPath(env, destination), 302);
  });

  app.post("/logout", async (c) => {
    try {
      assertStorefrontOrigin(c, shopStorefrontBaseUrl(env));
    } catch {
      return c.json({ error: "csrf_failed" }, 403);
    }
    const session = await readSession(sessionRepository, c);
    const sessionId = session?.id ?? readSessionId(c);
    const idTokenHint =
      (sessionId ? await tokenService.readIdTokenForLogout(sessionId) : null) ?? null;
    await sessionRepository.invalidate(sessionId);
    if (sessionId) {
      clearResourceTokenCacheForSession(sessionId);
      await tokenService.clear(sessionId);
    }
    clearShopAuthCookies(c);
    markShopSilentSuppressed(c, secureCookies);
    clearBasketToken(c);
    clearCommerceCsrfCookie(c);
    const state = randomBytes(24).toString("base64url");
    return c.redirect(
      buildEndSessionUrl({
        discovery,
        clientId: env.OIDC_CLIENT_ID,
        idTokenHint,
        postLogoutRedirectUri: env.OIDC_POST_LOGOUT_REDIRECT_URI,
        state,
      }),
      303,
    );
  });
}
