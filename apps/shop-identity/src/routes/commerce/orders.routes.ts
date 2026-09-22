import type { Hono } from "hono";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyAuthenticatedCommerce } from "./proxy-authenticated-commerce.js";

export function registerCommerceOrdersRoutes(app: Hono, deps: CommerceRoutesDeps): void {
  app.get("/commerce/orders", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/orders",
      scopes: "shop.read",
    }),
  );

  app.get("/commerce/orders/:orderId", (c) => {
    const orderId = c.req.param("orderId");
    return proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: `/v1/orders/${encodeURIComponent(orderId)}`,
      scopes: "shop.read",
    });
  });

  app.post("/commerce/orders/:orderId/cancel", async (c) => {
    const orderId = c.req.param("orderId");
    return proxyAuthenticatedCommerce(c, deps, {
      method: "POST",
      path: `/v1/orders/${encodeURIComponent(orderId)}/cancel`,
      scopes: "shop.write",
      requireCsrf: true,
    });
  });
}
