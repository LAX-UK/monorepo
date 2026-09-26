import { Hono } from "hono";
import { clearShopAuthCookies } from "./clear-shop-auth-cookies.js";
import { ShopIdentityReauthRequiredError } from "./errors/shop-identity-reauth.error.js";
import { ShopIdentityUpstreamError } from "./errors/shop-identity-upstream.error.js";
import { shopApiFetch } from "./infrastructure/shop-api.client.js";
import { registerBackchannelLogoutRoutes } from "./routes/backchannel-logout.routes.js";
import { registerCommerceRoutes } from "./routes/commerce.routes.js";
import { registerFedcmCompleteRoutes } from "./routes/fedcm-complete.routes.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerOAuthRoutes } from "./routes/oauth.routes.js";
import { registerSessionRoutes } from "./routes/session.routes.js";
import { type ShopIdentitySsfDeps, registerSsfRoutes } from "./routes/ssf.routes.js";
import type { ShopIdentityAppDeps } from "./shop-identity-app-deps.js";

export function createShopIdentityApp(deps: ShopIdentityAppDeps, ssf: ShopIdentitySsfDeps): Hono {
  const app = new Hono();
  registerSsfRoutes(app, ssf);
  registerHealthRoutes(app, deps);
  registerSessionRoutes(app, deps);
  registerCommerceRoutes(app, {
    env: deps.env,
    secureCookies: deps.secureCookies,
    sessionRepository: deps.sessionRepository,
    tokenService: deps.tokenService,
    shopApi: {
      baseUrl: deps.env.SHOP_API_BASE_URL,
      bffToken: deps.env.SHOP_API_BFF_TOKEN ?? "",
      tokenEndpoint: `${(deps.env.OIDC_INTERNAL_BASE_URL ?? deps.env.OIDC_ISSUER_URL).replace(/\/+$/, "")}/api/auth/oauth2/token`,
      clientId: deps.env.OIDC_CLIENT_ID,
      clientSecret: deps.env.OIDC_CLIENT_SECRET,
    },
    shopApiFetch,
  });
  registerOAuthRoutes(app, deps);
  registerFedcmCompleteRoutes(app, deps.env.FEDCM_ENABLED);
  registerBackchannelLogoutRoutes(app, {
    verifyLogoutToken: deps.verifyLogoutToken,
    sessions: deps.sessionRepository,
  });

  app.onError((error, c) => {
    if (error instanceof ShopIdentityReauthRequiredError) {
      clearShopAuthCookies(c);
      return c.json({ error: "sign_in_required" }, 401);
    }
    if (error instanceof ShopIdentityUpstreamError) {
      const errorCode =
        error.code === "shop_api_fetch"
          ? "shop_api_unavailable"
          : error.code === "oidc_token_exchange"
            ? "identity_token_unavailable"
            : "identity_upstream_unavailable";
      return c.json({ error: errorCode }, 503);
    }
    console.error(error);
    return c.json({ error: "internal" }, 500);
  });

  return app;
}
