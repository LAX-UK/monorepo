import type { Context, Hono } from "hono";
import { readBasketToken, rotateBasketToken } from "../../basket-cookie.js";
import {
  createGuestCheckoutBodySchema,
  guestCheckoutSessionSchema,
  guestEmailCheckBodySchema,
  guestOrderLinkResendBodySchema,
  guestOrderViewStateSchema,
} from "../../commerce-bodies.js";
import { commerceClientIp } from "../../commerce-client-ip.js";
import { assertCommerceCsrf } from "../../commerce-csrf.js";
import { resolveGuestCommerceContext } from "../../commerce-session.js";
import { readGuestOrderToken, writeGuestOrderToken } from "../../guest-order-cookie.js";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyFile } from "./proxy-authenticated-commerce.js";
import { proxyJson } from "./proxy-json.js";

/**
 * Checkout without an account. Every call goes to the shop API as the storefront (its BFF token)
 * with the visitor's address for the per-visitor limits; the API repeats the LAX account check
 * whenever an order is placed. The order token lives only in an httpOnly cookie.
 */
export function registerCommerceGuestCheckoutRoutes(
  app: Hono,
  deps: CommerceRoutesDeps,
  storefrontOrigin: string,
): void {
  const guestCheckoutBodySchema = createGuestCheckoutBodySchema(storefrontOrigin);

  async function asStorefront(
    c: Context,
    input: {
      path: string;
      scopes: "shop.read" | "shop.write";
      body: unknown;
      basketToken?: string;
    },
  ) {
    const guest = await resolveGuestCommerceContext(c, deps);
    return deps.shopApiFetch(deps.shopApi, {
      sessionId: guest.sessionId,
      idToken: null,
      scopes: input.scopes,
      path: input.path,
      method: "POST",
      body: input.body,
      clientIp: commerceClientIp(c),
      ...(input.basketToken ? { basketToken: input.basketToken } : {}),
    });
  }

  function csrfFailed(c: Context) {
    try {
      assertCommerceCsrf(c, storefrontOrigin);
      return null;
    } catch {
      return c.json({ error: "csrf_failed" }, 403);
    }
  }

  app.post("/commerce/guest-checkout/email-checks", async (c) => {
    const refused = csrfFailed(c);
    if (refused) return refused;
    const parsed = guestEmailCheckBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: "validation_failed" }, 400);
    return proxyJson(
      c,
      await asStorefront(c, {
        path: "/v1/guest-checkout/email-checks",
        scopes: "shop.write",
        body: parsed.data,
      }),
    );
  });

  app.post("/commerce/guest-checkout/orders", async (c) => {
    const refused = csrfFailed(c);
    if (refused) return refused;
    const basketToken = readBasketToken(c);
    if (!basketToken) return c.json({ error: "basket_not_found" }, 404);
    const parsed = guestCheckoutBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: "validation_failed" }, 400);
    const response = await asStorefront(c, {
      path: "/v1/guest-checkout/orders",
      scopes: "shop.write",
      body: parsed.data,
      basketToken,
    });
    if (!response.ok) return proxyJson(c, response);
    const parsedSession = guestCheckoutSessionSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!parsedSession.success) return c.json({ error: "invalid_upstream" }, 502);
    const session = parsedSession.data;
    writeGuestOrderToken(
      c,
      session.orderAccessToken,
      new Date(session.orderAccessExpiresAt),
      deps.secureCookies,
    );
    // The browser never sees the token itself.
    return c.json({
      orderId: session.orderId,
      checkoutUrl: session.checkoutUrl,
      expiresAt: session.expiresAt,
    });
  });

  app.get("/commerce/guest-orders/current", async (c) => {
    const token = readGuestOrderToken(c);
    if (!token) return c.json({ error: "not_found" }, 404);
    return proxyJson(
      c,
      await asStorefront(c, {
        path: "/v1/guest-orders/open",
        scopes: "shop.read",
        body: { token },
      }),
    );
  });

  /** Opened from the emailed link: keeps the token in the cookie when the link is good. */
  app.get("/commerce/guest-orders/links/:token", async (c) => {
    const token = c.req.param("token");
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return c.json({ error: "not_found" }, 404);
    const response = await asStorefront(c, {
      path: "/v1/guest-orders/open",
      scopes: "shop.read",
      body: { token },
    });
    if (!response.ok) return proxyJson(c, response);
    const body: unknown = await response.json().catch(() => null);
    const view = guestOrderViewStateSchema.safeParse(body);
    if (!view.success) return c.json({ error: "invalid_upstream" }, 502);
    if (view.data.state === "valid") {
      writeGuestOrderToken(c, token, new Date(view.data.linkExpiresAt), deps.secureCookies);
    }
    return c.json(body as Record<string, unknown>);
  });

  app.get("/commerce/guest-orders/current/invoice", async (c) => {
    const token = readGuestOrderToken(c);
    if (!token) return c.json({ error: "not_found" }, 404);
    const response = await asStorefront(c, {
      path: "/v1/guest-orders/invoice",
      scopes: "shop.read",
      body: { token },
    });
    return response.ok ? proxyFile(c, response) : proxyJson(c, response);
  });

  /** Back from the payment page without paying: the order is cancelled, the basket refilled. */
  app.post("/commerce/guest-orders/current/cancel", async (c) => {
    const refused = csrfFailed(c);
    if (refused) return refused;
    const token = readGuestOrderToken(c);
    if (!token) return c.json({ error: "not_found" }, 404);
    const basketToken = readBasketToken(c) ?? rotateBasketToken(c, deps.secureCookies);
    return proxyJson(
      c,
      await asStorefront(c, {
        path: "/v1/guest-orders/cancel",
        scopes: "shop.write",
        body: { token },
        basketToken,
      }),
    );
  });

  app.post("/commerce/guest-orders/links", async (c) => {
    const refused = csrfFailed(c);
    if (refused) return refused;
    const parsed = guestOrderLinkResendBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: "validation_failed" }, 400);
    return proxyJson(
      c,
      await asStorefront(c, {
        path: "/v1/guest-orders/links",
        scopes: "shop.write",
        body: parsed.data,
      }),
    );
  });
}
