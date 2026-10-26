import type { Hono } from "hono";
import { orderProblemReportBodySchema } from "../../commerce-bodies.js";
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

  app.get("/commerce/orders/:orderId/invoice", (c) => {
    const orderId = c.req.param("orderId");
    return proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: `/v1/orders/${encodeURIComponent(orderId)}/invoice`,
      scopes: "shop.read",
      file: true,
    });
  });

  app.post("/commerce/orders/:orderId/problem-reports", async (c) => {
    const orderId = c.req.param("orderId");
    const parsed = orderProblemReportBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json({ error: "validation_failed" }, 400);
    }
    return proxyAuthenticatedCommerce(c, deps, {
      method: "POST",
      path: `/v1/orders/${encodeURIComponent(orderId)}/problem-reports`,
      scopes: "shop.write",
      body: parsed.data,
      requireCsrf: true,
    });
  });

  app.post("/commerce/orders/:orderId/resume-checkout", async (c) => {
    const orderId = c.req.param("orderId");
    return proxyAuthenticatedCommerce(c, deps, {
      method: "POST",
      path: `/v1/orders/${encodeURIComponent(orderId)}/resume-checkout`,
      scopes: "shop.write",
      requireCsrf: true,
      requireVerifiedEmail: true,
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
