import type { Hono } from "hono";
import { artworkInterestBodySchema } from "../../commerce-bodies.js";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyAuthenticatedCommerce } from "./proxy-authenticated-commerce.js";
import { proxyEnquiry } from "./proxy-enquiry.js";

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
    const parsed = artworkInterestBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json({ error: "validation_failed" }, 400);
    }
    const isAlert = (parsed.data.intent ?? "notify_me") === "notify_me";
    return proxyEnquiry(c, deps, {
      path: `/v1/artworks/${encodeURIComponent(slug)}/interest`,
      body: parsed.data,
      allowGuest: true,
      // An alert only needs somewhere to write; an enquiry also needs a name to reply to.
      guestContact: isAlert ? "email" : "name_and_email",
    });
  });

  // Edition alerts in the shopper's account.
  app.get("/commerce/me/alerts", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/alerts",
      scopes: "shop.read",
    }),
  );

  app.delete("/commerce/me/alerts/:alertId", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "DELETE",
      path: `/v1/me/alerts/${encodeURIComponent(c.req.param("alertId"))}`,
      scopes: "shop.write",
      requireCsrf: true,
    }),
  );

  app.delete("/commerce/me/alerts/artworks/:slug", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "DELETE",
      path: `/v1/me/alerts/artworks/${encodeURIComponent(c.req.param("slug"))}`,
      scopes: "shop.write",
      requireCsrf: true,
    }),
  );
}
