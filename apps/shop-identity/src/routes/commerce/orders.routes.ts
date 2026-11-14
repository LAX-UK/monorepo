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

  /** The buyer's invoice card from Books (LAX's own invoice while Books does not issue it). */
  app.get("/commerce/orders/:orderId/invoice-card", (c) => {
    const orderId = c.req.param("orderId");
    return proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: `/v1/orders/${encodeURIComponent(orderId)}/invoice-card`,
      scopes: "shop.read",
    });
  });

  /** LAX's stored copy of the invoice Books issued, passed through as the PDF it is. */
  app.get("/commerce/orders/:orderId/invoice-documents/:documentId", (c) => {
    const orderId = c.req.param("orderId");
    const documentId = c.req.param("documentId");
    return proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: `/v1/orders/${encodeURIComponent(orderId)}/invoice-documents/${encodeURIComponent(documentId)}`,
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

  /** Accept the gallery's delivery quote for this order, then go to secure payment. */
  app.post("/commerce/orders/:orderId/accept-delivery-quote", async (c) => {
    const orderId = c.req.param("orderId");
    return proxyAuthenticatedCommerce(c, deps, {
      method: "POST",
      path: `/v1/orders/${encodeURIComponent(orderId)}/accept-delivery-quote`,
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
