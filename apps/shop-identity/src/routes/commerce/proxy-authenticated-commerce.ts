import type { Context } from "hono";
import { assertCommerceCsrf } from "../../commerce-csrf.js";
import { resolveAuthenticatedCommerceContext } from "../../commerce-session.js";
import { ShopIdentityReauthRequiredError } from "../../errors/shop-identity-reauth.error.js";
import { hasVerifiedEmail } from "../../verified-email.js";
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
    requireVerifiedEmail?: boolean;
    basketToken?: string;
    idempotencyKey?: string;
    /** Pass a successful file response (an invoice PDF) through as it is, not as JSON. */
    file?: boolean;
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
  if (
    options.requireVerifiedEmail &&
    !(await hasVerifiedEmail(deps.tokenService, auth.sessionId, auth.idToken))
  ) {
    return c.json({ error: "email_not_verified" }, 403);
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
  if (options.file && response.ok) return proxyFile(c, response);
  return proxyJson(c, response);
}

/** Only these response headers reach the browser with a file; nothing else from upstream does. */
const FILE_HEADERS = ["content-type", "content-disposition", "content-length"] as const;

function proxyFile(c: Context, response: Response) {
  const headers: Record<string, string> = { "cache-control": "private, no-store" };
  for (const name of FILE_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  return c.newResponse(response.body, 200, headers);
}
