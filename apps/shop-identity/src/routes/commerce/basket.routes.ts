import { randomBytes } from "node:crypto";
import type { Context, Hono } from "hono";
import { readBasketToken, rotateBasketToken, writeBasketToken } from "../../basket-cookie.js";
import { upsertBasketLineBodySchema } from "../../commerce-bodies.js";
import { assertCommerceCsrf } from "../../commerce-csrf.js";
import {
  resolveAuthenticatedCommerceContext,
  resolveGuestCommerceContext,
} from "../../commerce-session.js";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { EMPTY_BASKET, proxyJson } from "./proxy-json.js";

function ensureBasketToken(c: Context, secure: boolean): string {
  const existing = readBasketToken(c);
  if (existing) return existing;
  const token = randomBytes(32).toString("base64url");
  writeBasketToken(c, token, secure);
  return token;
}

export function registerCommerceBasketRoutes(
  app: Hono,
  deps: CommerceRoutesDeps,
  storefrontOrigin: string,
): void {
  app.get("/commerce/basket", async (c) => {
    const auth = await resolveAuthenticatedCommerceContext(c, deps);
    if (auth) {
      const response = await deps.shopApiFetch(deps.shopApi, {
        sessionId: auth.sessionId,
        idToken: auth.idToken,
        scopes: "shop.read",
        path: "/v1/basket",
        method: "GET",
        basketToken: null,
      });
      if (response.status === 404) {
        return c.json(EMPTY_BASKET);
      }
      return proxyJson(c, response);
    }
    const basketToken = readBasketToken(c);
    if (!basketToken) {
      return c.json(EMPTY_BASKET);
    }
    const guest = await resolveGuestCommerceContext(c, deps);
    const response = await deps.shopApiFetch(deps.shopApi, {
      sessionId: guest.sessionId,
      idToken: null,
      scopes: "shop.read",
      path: "/v1/basket",
      method: "GET",
      basketToken,
    });
    if (response.status === 404) {
      return c.json(EMPTY_BASKET);
    }
    return proxyJson(c, response);
  });

  app.put("/commerce/basket/lines", async (c) => {
    try {
      assertCommerceCsrf(c, storefrontOrigin);
    } catch {
      return c.json({ error: "csrf_failed" }, 403);
    }
    const parsed = upsertBasketLineBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "validation_failed" }, 400);
    }
    const body = parsed.data;
    const auth = await resolveAuthenticatedCommerceContext(c, deps);
    if (auth) {
      const response = await deps.shopApiFetch(deps.shopApi, {
        sessionId: auth.sessionId,
        idToken: auth.idToken,
        scopes: "shop.write",
        path: "/v1/basket/lines",
        method: "PUT",
        basketToken: null,
        body,
      });
      return proxyJson(c, response);
    }
    const guest = await resolveGuestCommerceContext(c, deps);
    const basketToken = ensureBasketToken(c, deps.secureCookies);
    const response = await deps.shopApiFetch(deps.shopApi, {
      sessionId: guest.sessionId,
      idToken: null,
      scopes: "shop.write",
      path: "/v1/basket/lines",
      method: "PUT",
      basketToken,
      body,
    });
    return proxyJson(c, response);
  });

  app.delete("/commerce/basket/lines/:lineId", async (c) => {
    try {
      assertCommerceCsrf(c, storefrontOrigin);
    } catch {
      return c.json({ error: "csrf_failed" }, 403);
    }
    const lineId = c.req.param("lineId");
    const auth = await resolveAuthenticatedCommerceContext(c, deps);
    if (auth) {
      const response = await deps.shopApiFetch(deps.shopApi, {
        sessionId: auth.sessionId,
        idToken: auth.idToken,
        scopes: "shop.write",
        path: `/v1/basket/lines/${encodeURIComponent(lineId)}`,
        method: "DELETE",
        basketToken: null,
      });
      return proxyJson(c, response);
    }
    const guest = await resolveGuestCommerceContext(c, deps);
    const basketToken = ensureBasketToken(c, deps.secureCookies);
    const response = await deps.shopApiFetch(deps.shopApi, {
      sessionId: guest.sessionId,
      idToken: null,
      scopes: "shop.write",
      path: `/v1/basket/lines/${encodeURIComponent(lineId)}`,
      method: "DELETE",
      basketToken,
    });
    return proxyJson(c, response);
  });

  app.post("/commerce/basket/merge-on-sign-in", async (c) => {
    try {
      assertCommerceCsrf(c, storefrontOrigin);
    } catch {
      return c.json({ error: "csrf_failed" }, 403);
    }
    const auth = await resolveAuthenticatedCommerceContext(c, deps);
    if (!auth) return c.json({ error: "sign_in_required" }, 401);
    const fromToken = readBasketToken(c);
    if (!fromToken) {
      return c.json({ merged: false });
    }
    const response = await deps.shopApiFetch(deps.shopApi, {
      sessionId: auth.sessionId,
      idToken: auth.idToken,
      scopes: "shop.write",
      path: "/v1/basket/merge",
      method: "POST",
      body: { fromToken },
    });
    if (!response.ok) {
      return proxyJson(c, response);
    }
    rotateBasketToken(c, deps.secureCookies);
    return c.json({ merged: true });
  });
}
