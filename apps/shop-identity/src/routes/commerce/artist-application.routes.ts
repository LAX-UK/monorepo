import type { Context, Hono } from "hono";
import type { CommerceRoutesDeps } from "./commerce-route-types.js";
import { proxyAuthenticatedCommerce } from "./proxy-authenticated-commerce.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE = "/v1/me/artist-application";

/** The application id from the path, or null; never forwarded unless it is a UUID. */
function applicationPath(c: Context, suffix = ""): string | null {
  const id = c.req.param("id") ?? "";
  return UUID.test(id) ? `${BASE}/${id}${suffix}` : null;
}

async function jsonBody(c: Context): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

/**
 * The signed-in artist's application to join the gallery, for lax.art. Reads need the session;
 * writes also need the commerce CSRF token. shop-api validates every body and owns the rules.
 */
export function registerCommerceArtistApplicationRoutes(app: Hono, deps: CommerceRoutesDeps): void {
  app.get("/commerce/me/artist-application", (c) =>
    proxyAuthenticatedCommerce(c, deps, { method: "GET", path: BASE, scopes: "shop.read" }),
  );

  app.post("/commerce/me/artist-application", (c) =>
    proxyAuthenticatedCommerce(c, deps, {
      method: "POST",
      path: BASE,
      scopes: "shop.write",
      requireCsrf: true,
    }),
  );

  const write =
    (method: "PUT" | "POST", suffix: string) =>
    async (c: Context): Promise<Response> => {
      const path = applicationPath(c, suffix);
      if (!path) return c.json({ error: "not_found" }, 404);
      return proxyAuthenticatedCommerce(c, deps, {
        method,
        path,
        scopes: "shop.write",
        requireCsrf: true,
        body: await jsonBody(c),
      });
    };

  app.put("/commerce/me/artist-application/:id", write("PUT", ""));
  app.post("/commerce/me/artist-application/:id/submit", write("POST", "/submit"));
  app.post("/commerce/me/artist-application/:id/images/presign", write("POST", "/images/presign"));
  app.post("/commerce/me/artist-application/:id/images/confirm", write("POST", "/images/confirm"));
}
