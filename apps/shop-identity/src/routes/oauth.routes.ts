import { createHash, randomBytes } from "node:crypto";
import {
  type OidcAuthorizePrompt,
  classifySilentCallback,
  createSilentSignInCookieSpec,
} from "@auction/identity-rp";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type {
  CompleteOAuthCallbackInput,
  CompleteOAuthCallbackResult,
} from "../application/complete-oauth-callback.handler.js";
import { refreshExpiresAtFromNow } from "../application/token-expiry.js";
import { isBackgroundShopAuthRequest, isDocumentShopAuthRequest } from "../auth-request-policy.js";
import { logShopIdentityAuth } from "../auth-telemetry.js";
import { clearBasketToken } from "../basket-cookie.js";
import { clearShopAuthCookies } from "../clear-shop-auth-cookies.js";
import { assertStorefrontOrigin, clearCommerceCsrfCookie } from "../commerce-csrf.js";
import { clearResourceTokenCacheForSession } from "../infrastructure/shop-api.client.js";
import { buildAuthorizeUrl, buildEndSessionUrl, generateOAuthLoginParams } from "../oidc.js";
import {
  SHOP_AUTH_ATTEMPT_COOKIE_NAME,
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
  markShopSilentNotice,
  markShopSilentProbe,
  markShopSilentQuiet,
  markShopSilentSuppressed,
} from "../silent-sign-in-cookies.js";
import { assertStorefrontRedirectNotIdentityOwned } from "../storefront-owned-prefixes.js";
import { shopStorefrontBaseUrl, shopStorefrontPath } from "../storefront-routes.js";

type OAuthRoutesDeps = Pick<
  ShopIdentityAppDeps,
  "env" | "sessionRepository" | "discovery" | "secureCookies" | "tokenService"
> & {
  completeOAuthCallback(input: CompleteOAuthCallbackInput): Promise<CompleteOAuthCallbackResult>;
};

const SHOP_SILENT_COOKIE_PREFIX = "shop_sso";

function oauthStateCorrelationHash(state: string): string {
  return createHash("sha256").update(state).digest("hex").slice(0, 16);
}

export function registerOAuthRoutes(app: Hono, deps: OAuthRoutesDeps): void {
  const { env, sessionRepository, discovery, secureCookies, tokenService } = deps;
  const silentCookieNames = createSilentSignInCookieSpec(SHOP_SILENT_COOKIE_PREFIX);

  function safeReturnToFromQuery(c: Context): string {
    const returnTo = c.req.query("returnTo");
    return typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/";
  }

  function safeReturnToFromCookie(c: Context): string {
    const returnTo = getCookie(c, "shop_return_to");
    deleteCookie(c, "shop_return_to", { path: "/" });
    return typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/";
  }

  function parseAuthAttempt(raw: string | undefined): { returnTo: string; count: number } | null {
    if (!raw) return null;
    const separator = raw.lastIndexOf("|");
    if (separator <= 0) return null;
    const returnTo = raw.slice(0, separator);
    const count = Number(raw.slice(separator + 1));
    if (!returnTo.startsWith("/") || returnTo.startsWith("//") || !Number.isFinite(count)) {
      return null;
    }
    return { returnTo, count };
  }

  function storefrontSignInError(code: string): string {
    const location = shopStorefrontPath(env, `/sign-in-error?reason=${encodeURIComponent(code)}`);
    assertStorefrontRedirectNotIdentityOwned(location);
    return location;
  }

  function skipBackgroundAuthStart(c: Context) {
    logShopIdentityAuth("auth_start_skipped_background", { path: c.req.path });
    return c.body(null, 204);
  }

  function safeReturnToFromRequest(c: Context): string | null {
    const fromQuery = c.req.query("returnTo");
    if (typeof fromQuery === "string" && fromQuery.startsWith("/") && !fromQuery.startsWith("//")) {
      return fromQuery;
    }
    const fromCookie = getCookie(c, "shop_return_to");
    if (
      typeof fromCookie === "string" &&
      fromCookie.startsWith("/") &&
      !fromCookie.startsWith("//")
    ) {
      return fromCookie;
    }
    return null;
  }

  function redirectStorefrontInteractiveLogin(c: Context, returnTo?: string | null) {
    const safeReturnTo = returnTo ?? safeReturnToFromRequest(c);
    deleteCookie(c, "shop_return_to", { path: "/" });
    if (safeReturnTo) {
      return c.redirect(
        shopStorefrontPath(env, `/login?returnTo=${encodeURIComponent(safeReturnTo)}`),
        302,
      );
    }
    return c.redirect(shopStorefrontPath(env, "/login"), 302);
  }

  function redirectSilentProbeGuest(c: Context, clearSession: boolean) {
    deleteCookie(c, SHOP_TOKEN_UPGRADE_COOKIE_NAME, { path: "/" });
    if (clearSession) {
      clearShopAuthCookies(c);
    }
    markShopSilentQuiet(c, secureCookies);
    const safeReturnTo = safeReturnToFromCookie(c);
    return c.redirect(shopStorefrontPath(env, safeReturnTo), 302);
  }

  async function startShopAuthorization(
    c: Context,
    options?: { prompt?: OidcAuthorizePrompt; requireAuthenticatedSession?: boolean },
  ) {
    if (isBackgroundShopAuthRequest(c)) {
      return skipBackgroundAuthStart(c);
    }
    const returnTo = c.req.query("returnTo");
    const safeReturnTo =
      typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : null;
    const isInteractiveLogin = !options?.prompt || options.prompt === "create";
    if (
      isInteractiveLogin &&
      !options?.requireAuthenticatedSession &&
      isDocumentShopAuthRequest(c)
    ) {
      const sessionId = readSessionId(c);
      if (sessionId) {
        const active = await sessionRepository.findActive(sessionId);
        if (active?.subject) {
          const hasRefresh = await tokenService.hasStoredRefreshToken(sessionId);
          if (hasRefresh) {
            logShopIdentityAuth("login_existing_session_post_sign_in", {
              reason: "healthy_session_merge_basket",
              hasReturnTo: Boolean(safeReturnTo),
            });
            const postSignInQuery = safeReturnTo
              ? new URLSearchParams({ returnTo: safeReturnTo }).toString()
              : "";
            const postSignInPath = postSignInQuery
              ? `/account/post-sign-in?${postSignInQuery}`
              : "/account/post-sign-in";
            return c.redirect(shopStorefrontPath(env, postSignInPath), 302);
          }
          logShopIdentityAuth("login_existing_session_missing_refresh", {
            reason: "interactive_oauth_required",
            hasReturnTo: Boolean(safeReturnTo),
          });
        }
      }
    }
    if (isInteractiveLogin && safeReturnTo && isDocumentShopAuthRequest(c)) {
      const parsed = parseAuthAttempt(getCookie(c, SHOP_AUTH_ATTEMPT_COOKIE_NAME));
      if (parsed?.returnTo === safeReturnTo && parsed.count >= 2) {
        return c.redirect(shopStorefrontPath(env, "/session-expired"), 302);
      }
      const nextCount = parsed?.returnTo === safeReturnTo ? parsed.count + 1 : 1;
      setCookie(c, SHOP_AUTH_ATTEMPT_COOKIE_NAME, `${safeReturnTo}|${nextCount}`, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: "Lax",
        path: "/",
        maxAge: 60,
      });
    }
    if (safeReturnTo) {
      setCookie(c, "shop_return_to", safeReturnTo, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 10,
      });
    }
    const oauth = generateOAuthLoginParams();
    logShopIdentityAuth("auth_start", {
      oauthStateHash: oauthStateCorrelationHash(oauth.state),
      hasReturnTo: Boolean(safeReturnTo),
    });
    if (options?.requireAuthenticatedSession) {
      const sessionId = readSessionId(c);
      const session = sessionId ? await sessionRepository.findActive(sessionId) : null;
      if (!session?.subject || !sessionId) {
        return redirectStorefrontInteractiveLogin(c);
      }
      const attached = await sessionRepository.attachPendingOAuthToAuthenticatedSession(
        sessionId,
        oauth,
      );
      if (!attached) {
        return redirectStorefrontInteractiveLogin(c);
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

  app.get("/login", async (c) => {
    if (isBackgroundShopAuthRequest(c)) {
      return skipBackgroundAuthStart(c);
    }
    clearShopSilentSuppressed(c);
    return startShopAuthorization(c);
  });
  app.get("/register", async (c) => {
    if (isBackgroundShopAuthRequest(c)) {
      return skipBackgroundAuthStart(c);
    }
    clearShopSilentSuppressed(c);
    return startShopAuthorization(c, { prompt: "create" });
  });

  app.get("/auth/sso-probe", async (c) => {
    if (isBackgroundShopAuthRequest(c)) {
      return skipBackgroundAuthStart(c);
    }
    const safeReturnTo = safeReturnToFromQuery(c);
    if (getCookie(c, silentCookieNames.suppressed) || getCookie(c, silentCookieNames.quiet)) {
      return c.redirect(shopStorefrontPath(env, safeReturnTo), 302);
    }
    const sessionId = readSessionId(c);
    if (sessionId) {
      const active = await sessionRepository.findActive(sessionId);
      if (active?.subject) {
        return c.redirect(shopStorefrontPath(env, safeReturnTo), 302);
      }
    }
    markShopSilentProbe(c, secureCookies);
    return startShopAuthorization(c, { prompt: "none" });
  });

  app.get("/auth/upgrade", async (c) => {
    if (isBackgroundShopAuthRequest(c)) {
      return skipBackgroundAuthStart(c);
    }
    if (isDocumentShopAuthRequest(c)) {
      const prior = getCookie(c, SHOP_TOKEN_UPGRADE_COOKIE_NAME);
      const count = prior ? Number(prior) : 0;
      if (Number.isFinite(count) && count >= 2) {
        return c.redirect(shopStorefrontPath(env, "/session-expired"), 302);
      }
      setCookie(c, SHOP_TOKEN_UPGRADE_COOKIE_NAME, String(count + 1), {
        httpOnly: true,
        secure: secureCookies,
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 5,
      });
    }
    return startShopAuthorization(c, { prompt: "none", requireAuthenticatedSession: true });
  });

  app.get("/auth/callback", async (c) => {
    const receivedState = c.req.query("state") ?? null;
    const session = await readSession(sessionRepository, c);
    const oauthError = c.req.query("error") ?? null;
    const probeActive = Boolean(getCookie(c, SHOP_SILENT_SSO_COOKIE_NAMES.probe));
    const silentCallback = classifySilentCallback(oauthError);
    if (probeActive && silentCallback.kind !== "success") {
      if (session?.id) {
        await tokenService.clear(session.id);
      }
      return redirectSilentProbeGuest(c, true);
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
      const returnTo = safeReturnToFromRequest(c);
      clearShopAuthCookies(c);
      logShopIdentityAuth("oauth_callback", {
        kind: "upgrade_login_required",
        code: oauthError ?? undefined,
        probe: probeActive,
        ...(receivedState ? { oauthStateHash: oauthStateCorrelationHash(receivedState) } : {}),
      });
      return redirectStorefrontInteractiveLogin(c, returnTo);
    }
    const result = await deps.completeOAuthCallback({
      session,
      receivedState,
      code: c.req.query("code") ?? null,
      oauthError,
    });
    logShopIdentityAuth("oauth_callback", {
      kind: result.kind,
      code: result.kind === "error" ? result.code : undefined,
      probe: probeActive,
      ...(receivedState ? { oauthStateHash: oauthStateCorrelationHash(receivedState) } : {}),
      ...(result.kind === "error" && result.tokenExchangeFailureClass
        ? { tokenExchangeFailureClass: result.tokenExchangeFailureClass }
        : {}),
      ...(result.kind === "error" && result.oauthError ? { oauthError: result.oauthError } : {}),
    });
    deleteCookie(c, SHOP_TOKEN_UPGRADE_COOKIE_NAME, { path: "/" });
    if (probeActive) {
      clearShopSilentProbe(c);
    }
    if (result.kind === "session_expired") {
      if (probeActive) {
        return redirectSilentProbeGuest(c, false);
      }
      return c.redirect(shopStorefrontPath(env, "/session-expired"), 302);
    }
    if (result.kind === "error") {
      if (probeActive) {
        if (session?.id) {
          await tokenService.clear(session.id);
        }
        return redirectSilentProbeGuest(c, true);
      }
      return c.redirect(storefrontSignInError(result.code), 302);
    }
    if (result.kind === "disabled") {
      if (probeActive) {
        if (session?.id) {
          await tokenService.clear(session.id);
        }
        return redirectSilentProbeGuest(c, true);
      }
      clearShopAuthCookies(c);
      return c.redirect(shopStorefrontPath(env, "/account/disabled"), 302);
    }
    writeSessionCookie(c, result.sessionId, { secure: secureCookies });
    deleteCookie(c, SHOP_AUTH_ATTEMPT_COOKIE_NAME, { path: "/" });
    clearShopSilentSuppressed(c);
    if (probeActive) {
      markShopSilentNotice(c, secureCookies);
    }
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
    const postSignInParams = new URLSearchParams();
    if (safeReturnTo) {
      postSignInParams.set("returnTo", safeReturnTo);
    }
    if (probeActive) {
      postSignInParams.set("silentNotice", "1");
    }
    const postSignInQuery = postSignInParams.toString();
    const destination = postSignInQuery
      ? `/account/post-sign-in?${postSignInQuery}`
      : probeActive
        ? "/account/post-sign-in?silentNotice=1"
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
