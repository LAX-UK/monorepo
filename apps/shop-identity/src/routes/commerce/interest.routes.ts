import type { Hono } from "hono";
import { z } from "zod";
import { artworkInterestBodySchema, releaseAlertBodySchema } from "../../commerce-bodies.js";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyAuthenticatedCommerce } from "./proxy-authenticated-commerce.js";
import { proxyEnquiry } from "./proxy-enquiry.js";

const emailAlertSwitchBodySchema = z.object({ on: z.boolean() }).strict();
/** The topics a person switches themselves; "Notify me" requests are per edition. */
const EMAIL_ALERT_TOPICS: ReadonlySet<string> = new Set(["shop.releases", "art.followed_artists"]);

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

  // The shopper's own alert switches, for the Follow button's email state on lax.art.
  app.get("/commerce/me/email-alerts", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/email-alerts",
      scopes: "shop.read",
    }),
  );

  app.put("/commerce/me/email-alerts/topics/:topic", async (c) => {
    const topic = c.req.param("topic");
    const parsed = emailAlertSwitchBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success || !EMAIL_ALERT_TOPICS.has(topic)) {
      return c.json({ error: "validation_failed" }, 400);
    }
    return proxyAuthenticatedCommerce(c, deps, {
      method: "PUT",
      path: `/v1/me/email-alerts/topics/${encodeURIComponent(topic)}`,
      scopes: "shop.write",
      body: parsed.data,
      requireCsrf: true,
    });
  });

  // Release alerts: a visitor confirms by email; a signed-in shopper is subscribed straight away.
  app.post("/commerce/release-alerts", async (c) => {
    const parsed = releaseAlertBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json({ error: "validation_failed" }, 400);
    }
    return proxyEnquiry(c, deps, {
      path: "/v1/release-alerts",
      body: parsed.data,
      allowGuest: true,
      guestContact: "email",
    });
  });

  app.get("/commerce/me/release-alerts", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/release-alerts",
      scopes: "shop.read",
    }),
  );

  app.delete("/commerce/me/release-alerts", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "DELETE",
      path: "/v1/me/release-alerts",
      scopes: "shop.write",
      requireCsrf: true,
    }),
  );
}
