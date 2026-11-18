import type { Context, Hono } from "hono";
import type { z } from "zod";
import { readBasketToken } from "../../basket-cookie.js";
import { commerceClientIp } from "../../commerce-client-ip.js";
import { assertCommerceCsrf } from "../../commerce-csrf.js";
import {
  resolveAuthenticatedCommerceContext,
  resolveGuestCommerceContext,
} from "../../commerce-session.js";
import {
  expressCheckoutConfirmBodySchema,
  expressCheckoutStartBodySchema,
  expressShippingAddressBodySchema,
  guestExpressCheckoutConfirmBodySchema,
  guestExpressCheckoutConfirmedSchema,
} from "../../express-checkout-bodies.js";
import { writeGuestOrderToken } from "../../guest-order-cookie.js";
import { hasVerifiedEmail } from "../../verified-email.js";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyJson } from "./proxy-json.js";

const STEPS = [
  { suffix: "", schema: expressCheckoutStartBodySchema },
  { suffix: "/shipping-address", schema: expressShippingAddressBodySchema },
  { suffix: "/confirm", schema: expressCheckoutConfirmBodySchema },
] as const;

/**
 * GAP-49 express checkout (Stripe's wallet row on the basket and Details). Signed-in shoppers go
 * to `/v1/orders/express-checkout*` with their token; guests go to
 * `/v1/guest-checkout/express-checkout*` as the storefront with the basket token, as the other
 * guest checkout routes do. shop-api refuses every step while SHOP_EXPRESS_CHECKOUT is off.
 */
export function registerCommerceExpressCheckoutRoutes(
  app: Hono,
  deps: CommerceRoutesDeps,
  storefrontOrigin: string,
): void {
  function csrfFailed(c: Context) {
    try {
      assertCommerceCsrf(c, storefrontOrigin);
      return null;
    } catch {
      return c.json({ error: "csrf_failed" }, 403);
    }
  }

  async function parse<T extends z.ZodTypeAny>(c: Context, schema: T) {
    return schema.safeParse(await c.req.json().catch(() => ({})));
  }

  for (const step of STEPS) {
    app.post(`/commerce/express-checkout${step.suffix}`, async (c) => {
      const refused = csrfFailed(c);
      if (refused) return refused;
      const auth = await resolveAuthenticatedCommerceContext(c, deps);
      if (!auth) return c.json({ error: "sign_in_required" }, 401);
      if (!(await hasVerifiedEmail(deps.tokenService, auth.sessionId, auth.idToken))) {
        return c.json({ error: "email_not_verified" }, 403);
      }
      const parsed = await parse(c, step.schema);
      if (!parsed.success) return c.json({ error: "validation_failed" }, 400);
      return proxyJson(
        c,
        await deps.shopApiFetch(deps.shopApi, {
          sessionId: auth.sessionId,
          idToken: auth.idToken,
          scopes: "shop.write",
          path: `/v1/orders/express-checkout${step.suffix}`,
          method: "POST",
          body: parsed.data,
        }),
      );
    });
  }

  async function asStorefront(c: Context, path: string, body: unknown, basketToken: string) {
    const guest = await resolveGuestCommerceContext(c, deps);
    return deps.shopApiFetch(deps.shopApi, {
      sessionId: guest.sessionId,
      idToken: null,
      scopes: "shop.write",
      path,
      method: "POST",
      body,
      clientIp: commerceClientIp(c),
      basketToken,
    });
  }

  for (const step of STEPS.slice(0, 2)) {
    app.post(`/commerce/guest-checkout/express-checkout${step.suffix}`, async (c) => {
      const refused = csrfFailed(c);
      if (refused) return refused;
      const basketToken = readBasketToken(c);
      if (!basketToken) return c.json({ error: "basket_not_found" }, 404);
      const parsed = await parse(c, step.schema);
      if (!parsed.success) return c.json({ error: "validation_failed" }, 400);
      return proxyJson(
        c,
        await asStorefront(
          c,
          `/v1/guest-checkout/express-checkout${step.suffix}`,
          parsed.data,
          basketToken,
        ),
      );
    });
  }

  app.post("/commerce/guest-checkout/express-checkout/confirm", async (c) => {
    const refused = csrfFailed(c);
    if (refused) return refused;
    const basketToken = readBasketToken(c);
    if (!basketToken) return c.json({ error: "basket_not_found" }, 404);
    const parsed = await parse(c, guestExpressCheckoutConfirmBodySchema);
    if (!parsed.success) return c.json({ error: "validation_failed" }, 400);
    const response = await asStorefront(
      c,
      "/v1/guest-checkout/express-checkout/confirm",
      parsed.data,
      basketToken,
    );
    if (!response.ok) return proxyJson(c, response);
    const confirmed = guestExpressCheckoutConfirmedSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!confirmed.success) return c.json({ error: "invalid_upstream" }, 502);
    const { orderId, returnUrl, expiresAt, orderAccessToken, orderAccessExpiresAt } =
      confirmed.data;
    // The confirmation page opens the guest order from this cookie; the browser never sees it.
    writeGuestOrderToken(c, orderAccessToken, new Date(orderAccessExpiresAt), deps.secureCookies);
    return c.json({ orderId, returnUrl, expiresAt });
  });
}
