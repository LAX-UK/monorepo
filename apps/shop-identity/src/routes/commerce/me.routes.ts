import type { Hono } from "hono";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyAuthenticatedCommerce } from "./proxy-authenticated-commerce.js";

export function registerCommerceMeRoutes(app: Hono, deps: CommerceRoutesDeps): void {
  app.get("/commerce/me/editions", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/editions",
      scopes: "shop.read",
    }),
  );

  app.get("/commerce/me/sale-authority", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/sale-authority",
      scopes: "shop.read",
    }),
  );

  app.post("/commerce/me/sale-authority-requests", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return proxyAuthenticatedCommerce(c, deps, {
      method: "POST",
      path: "/v1/me/sale-authority-requests",
      scopes: "shop.read",
      requireCsrf: true,
      body,
    });
  });
}
