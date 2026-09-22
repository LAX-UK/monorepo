import type { Context } from "hono";
import { assertCommerceCsrf } from "../../commerce-csrf.js";
import { resolveAuthenticatedCommerceContext } from "../../commerce-session.js";
import { ShopIdentityReauthRequiredError } from "../../errors/shop-identity-reauth.error.js";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyJson } from "./proxy-json.js";

type ShopApiScope = "shop.read" | "shop.write";

export async function proxyAuthenticatedCommerce(
  c: Context,
  deps: CommerceRoutesDeps,
  options: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    scopes: ShopApiScope;
    body?: unknown;
    requireCsrf?: boolean;
    basketToken?: string;
    idempotencyKey?: string;
  },
) {
  if (options.requireCsrf) {
    try {
      assertCommerceCsrf(c, deps.env.SHOP_STOREFRONT_URL);
    } catch {
      return c.json({ error: "csrf_failed" }, 403);
    }
  }
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
    scopes: options.scopes,
    path: options.path,
    method: options.method,
    ...(options.body !== undefined ? { body: options.body } : {}),
    ...(options.basketToken ? { basketToken: options.basketToken } : {}),
    ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
  });
  return proxyJson(c, response);
}
