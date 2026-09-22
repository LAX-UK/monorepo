import type { Hono } from "hono";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyAuthenticatedCommerce } from "./proxy-authenticated-commerce.js";

export function registerCommerceInterestRoutes(app: Hono, deps: CommerceRoutesDeps): void {
  app.get("/commerce/artworks/:slug/interest", (c) => {
    const slug = c.req.param("slug");
    const intent = c.req.query("intent");
    const query = intent ? `?intent=${encodeURIComponent(intent)}` : "";
    return proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: `/v1/artworks/${encodeURIComponent(slug)}/interest${query}`,
      scopes: "shop.read",
    });
  });

  app.post("/commerce/artworks/:slug/interest", async (c) => {
    const slug = c.req.param("slug");
    const body = await c.req.json().catch(() => ({}));
    return proxyAuthenticatedCommerce(c, deps, {
      method: "POST",
      path: `/v1/artworks/${encodeURIComponent(slug)}/interest`,
      scopes: "shop.write",
      body,
      requireCsrf: true,
    });
  });
}
