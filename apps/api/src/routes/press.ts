import { pressArchiveQuerySchema, pressDayMediaQuerySchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerPressRoutesSlice } from "../container.js";
import { respondCatalogHttpJson } from "../lib/catalog-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

function viewerFromContext(c: {
  get: (key: "userRole" | "userStaffRole") => string | null | undefined;
}) {
  return {
    role: c.get("userRole"),
    staffRole: c.get("userStaffRole") ?? null,
  };
}

export function createPressRoutes(
  container: ContainerPressRoutesSlice,
  authenticator: IAuthenticator,
) {
  const optionalAuth = createOptionalAuth(authenticator);
  const pressReadHttp = container.catalogRoutes.pressReadHttp;
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.get("/coverage", optionalAuth, zValidator("query", pressArchiveQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const response = await pressReadHttp.listCoverage({ query, viewer: viewerFromContext(c) });
    return respondCatalogHttpJson(c, response);
  });

  r.get("/day-media", optionalAuth, zValidator("query", pressDayMediaQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const response = await pressReadHttp.listDayMedia({ query, viewer: viewerFromContext(c) });
    return respondCatalogHttpJson(c, response);
  });

  r.get("/sitemap-freshness", optionalAuth, async (c) => {
    const response = await pressReadHttp.getSitemapFreshness({ viewer: viewerFromContext(c) });
    return respondCatalogHttpJson(c, response);
  });

  return r;
}
