import type { Hono } from "hono";
import { resolveAuthenticatedCommerceContext } from "../../commerce-session.js";
import { ShopIdentityReauthRequiredError } from "../../errors/shop-identity-reauth.error.js";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { portalDocumentsResponseSchema } from "./portal-documents.schema.js";
import { proxyAuthenticatedCommerce } from "./proxy-authenticated-commerce.js";
import { proxyJson } from "./proxy-json.js";

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

  app.get("/commerce/me/payouts", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "GET",
      path: "/v1/me/payouts",
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
    return proxyAuthenticatedCommerce(c, deps, {
      method: "POST",
      path: "/v1/me/sale-authority-requests",
      scopes: "shop.write",
      requireCsrf: true,
      body,
    });
  });
}
