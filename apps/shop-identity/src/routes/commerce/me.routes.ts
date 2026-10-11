import type { Hono } from "hono";
import { resolveAuthenticatedCommerceContext } from "../../commerce-session.js";
import { ShopIdentityReauthRequiredError } from "../../errors/shop-identity-reauth.error.js";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { portalDocumentsResponseSchema } from "./portal-documents.schema.js";
import { proxyAuthenticatedCommerce } from "./proxy-authenticated-commerce.js";
import { proxyJson } from "./proxy-json.js";

export function registerCommerceMeRoutes(app: Hono, deps: CommerceRoutesDeps): void {
  app.get("/commerce/me/collection", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/collection",
      scopes: "shop.read",
    }),
  );

  app.get("/commerce/me/favorites/artworks", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/favorites/artworks",
      scopes: "shop.read",
    }),
  );

  app.put("/commerce/me/favorites/artworks/:slug", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "PUT",
      path: `/v1/me/favorites/artworks/${encodeURIComponent(c.req.param("slug"))}`,
      scopes: "shop.write",
      requireCsrf: true,
    }),
  );

  app.delete("/commerce/me/favorites/artworks/:slug", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "DELETE",
      path: `/v1/me/favorites/artworks/${encodeURIComponent(c.req.param("slug"))}`,
      scopes: "shop.write",
      requireCsrf: true,
    }),
  );

  app.get("/commerce/me/favorites/artists", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/favorites/artists",
      scopes: "shop.read",
    }),
  );

  app.put("/commerce/me/favorites/artists/:slug", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "PUT",
      path: `/v1/me/favorites/artists/${encodeURIComponent(c.req.param("slug"))}`,
      scopes: "shop.write",
      requireCsrf: true,
    }),
  );

  app.delete("/commerce/me/favorites/artists/:slug", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "DELETE",
      path: `/v1/me/favorites/artists/${encodeURIComponent(c.req.param("slug"))}`,
      scopes: "shop.write",
      requireCsrf: true,
    }),
  );

  app.get("/commerce/me/enquiries", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/enquiries",
      scopes: "shop.read",
    }),
  );

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

  app.get("/commerce/me/connect/status", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/connect/status",
      scopes: "shop.read",
    }),
  );

  app.get("/commerce/me/connect/config", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/connect/config",
      scopes: "shop.read",
    }),
  );

  app.post("/commerce/me/connect/account-session", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return proxyAuthenticatedCommerce(c, deps, {
      method: "POST",
      path: "/v1/me/connect/account-session",
      scopes: "shop.write",
      requireCsrf: true,
      body,
    });
  });

  app.get("/commerce/me/payouts", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/payouts",
      scopes: "shop.read",
    }),
  );

  app.get("/commerce/me/sales", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/sales",
      scopes: "shop.read",
    }),
  );

  app.get("/commerce/me/sale-authority-requests", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/sale-authority-requests",
      scopes: "shop.read",
    }),
  );

  app.get("/commerce/me/artist/artworks", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/artist/artworks",
      scopes: "shop.read",
    }),
  );

  app.get("/commerce/me/artist/sales", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/artist/sales",
      scopes: "shop.read",
    }),
  );

  app.get("/commerce/me/documents", async (c) => {
    let auth: Awaited<ReturnType<typeof resolveAuthenticatedCommerceContext>>;
    try {
      auth = await resolveAuthenticatedCommerceContext(c, deps);
    } catch (error) {
      if (error instanceof ShopIdentityReauthRequiredError) {
        return c.json({ error: "sign_in_required" }, 401);
      }
      throw error;
    }
    if (!auth) {
      return c.json({ error: "sign_in_required" }, 401);
    }
    const response = await deps.shopApiFetch(deps.shopApi, {
      sessionId: auth.sessionId,
      idToken: auth.idToken,
      scopes: "shop.read",
      path: "/v1/me/documents",
      method: "GET",
    });
    if (!response.ok) {
      return proxyJson(c, response);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return c.json({ error: "invalid_upstream" }, 502);
    }
    const parsed = portalDocumentsResponseSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_upstream" }, 502);
    }
    return c.json(parsed.data);
  });

  app.post("/commerce/me/sale-authority-requests", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const idempotencyKey = c.req.header("idempotency-key") ?? undefined;
    return proxyAuthenticatedCommerce(c, deps, {
      method: "POST",
      path: "/v1/me/sale-authority-requests",
      scopes: "shop.write",
      requireCsrf: true,
      body,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  });
}
