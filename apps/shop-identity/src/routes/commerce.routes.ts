import type { Hono } from "hono";
import { SHOP_BASKET_COOKIE_NAME } from "../basket-cookie.js";
import { ensureCommerceCsrfCookie } from "../commerce-csrf.js";
import { shopStorefrontBaseUrl } from "../storefront-routes.js";
import { registerCommerceBasketRoutes } from "./commerce/basket.routes.js";
import { registerCommerceCheckoutRoutes } from "./commerce/checkout.routes.js";
import type { CommerceRoutesDeps } from "./commerce/commerce-route-types.js";
import { registerCommerceInterestRoutes } from "./commerce/interest.routes.js";
import { registerCommerceOrdersRoutes } from "./commerce/orders.routes.js";

export type { CommerceRoutesDeps } from "./commerce/commerce-route-types.js";

export function registerCommerceRoutes(app: Hono, deps: CommerceRoutesDeps): void {
  const storefrontOrigin = shopStorefrontBaseUrl(deps.env);

  app.get("/commerce/csrf", (c) => {
    const token = ensureCommerceCsrfCookie(c, deps.secureCookies);
    return c.json({ csrfToken: token });
  });

  registerCommerceBasketRoutes(app, deps, storefrontOrigin);
  registerCommerceCheckoutRoutes(app, deps, storefrontOrigin);
  registerCommerceOrdersRoutes(app, deps);
  registerCommerceInterestRoutes(app, deps);
}

export { SHOP_BASKET_COOKIE_NAME };
