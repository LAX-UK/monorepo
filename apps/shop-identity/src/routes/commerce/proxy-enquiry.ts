import type { Context } from "hono";
import { commerceClientIp } from "../../commerce-client-ip.js";
import { assertCommerceCsrf } from "../../commerce-csrf.js";
import {
  resolveAuthenticatedCommerceContext,
  resolveGuestCommerceContext,
} from "../../commerce-session.js";
import { ShopIdentityReauthRequiredError } from "../../errors/shop-identity-reauth.error.js";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyJson } from "./proxy-json.js";

type EnquiryBody = { name?: string | undefined; email?: string | undefined };

/**
 * Forwards an enquiry to the shop API as the signed-in account when there is one, and as a
 * guest otherwise. Guests carry no account, so name and email are mandatory: they are the only
 * way to reply. The browser address travels with guest requests because the API's own socket
 * peer is this BFF, and its rate limit needs the visitor's address.
 */
export async function proxyEnquiry(
  c: Context,
  deps: CommerceRoutesDeps,
  options: {
    path: string;
    body: EnquiryBody;
    /** False for requests that only an account can make, such as availability alerts. */
    allowGuest: boolean;
  },
) {
  try {
    assertCommerceCsrf(c, deps.env.SHOP_STOREFRONT_URL);
  } catch {
    return c.json({ error: "csrf_failed" }, 403);
  }
  let auth: Awaited<ReturnType<typeof resolveAuthenticatedCommerceContext>> = null;
  try {
    auth = await resolveAuthenticatedCommerceContext(c, deps);
  } catch (error) {
    // An expired sign-in can still send an enquiry as a guest.
    if (!(error instanceof ShopIdentityReauthRequiredError)) throw error;
  }
  if (auth) {
    return proxyJson(
      c,
      await deps.shopApiFetch(deps.shopApi, {
        sessionId: auth.sessionId,
        idToken: auth.idToken,
        scopes: "shop.write",
        path: options.path,
        method: "POST",
        body: options.body,
      }),
    );
  }
  if (!options.allowGuest) {
    return c.json({ error: "sign_in_required" }, 401);
  }
  if (!options.body.name || !options.body.email) {
    return c.json({ error: "validation_failed" }, 400);
  }
  const guest = await resolveGuestCommerceContext(c, deps);
  return proxyJson(
    c,
    await deps.shopApiFetch(deps.shopApi, {
      sessionId: guest.sessionId,
      idToken: null,
      scopes: "shop.write",
      path: options.path,
      method: "POST",
      body: options.body,
      clientIp: commerceClientIp(c),
    }),
  );
}
