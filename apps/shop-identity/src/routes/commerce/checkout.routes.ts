import type { Hono } from "hono";
import { createCheckoutBodySchema } from "../../commerce-bodies.js";
import { assertCommerceCsrf } from "../../commerce-csrf.js";
import { resolveAuthenticatedCommerceContext } from "../../commerce-session.js";
import { hasVerifiedEmail } from "../../verified-email.js";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyJson } from "./proxy-json.js";

export function registerCommerceCheckoutRoutes(
  app: Hono,
  deps: CommerceRoutesDeps,
  storefrontOrigin: string,
): void {
  const checkoutBodySchema = createCheckoutBodySchema(storefrontOrigin);

  app.post("/commerce/checkout", async (c) => {
    try {
      assertCommerceCsrf(c, storefrontOrigin);
    } catch {
      return c.json({ error: "csrf_failed" }, 403);
    }
    const auth = await resolveAuthenticatedCommerceContext(c, deps);
    if (!auth) {
      return c.json({ error: "sign_in_required" }, 401);
    }
    if (!(await hasVerifiedEmail(deps.tokenService, auth.sessionId, auth.idToken))) {
      return c.json({ error: "email_not_verified" }, 403);
    }
    const parsed = checkoutBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "validation_failed" }, 400);
    }
    const body = parsed.data;
    const response = await deps.shopApiFetch(deps.shopApi, {
      sessionId: auth.sessionId,
      idToken: auth.idToken,
      scopes: "shop.write",
      path: "/v1/orders/checkout",
      method: "POST",
      body,
    });
    return proxyJson(c, response);
  });
}
