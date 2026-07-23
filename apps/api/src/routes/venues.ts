import {
  createVenueSchema,
  listVenuesQuerySchema,
  updateVenueSchema,
  venueIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerVenueRoutesSlice } from "../container.js";
import { respondCatalogHttpJson } from "../lib/catalog-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireVenuesAccess } from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createVenueRoutes(
  container: ContainerVenueRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const http = () => container.catalogRoutes.venueHttp;
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.use("*", requireAuth, requireVenuesAccess);

  r.get("/", zValidator("query", listVenuesQuerySchema), async (c) => {
    const query = c.req.valid("query");
    return respondCatalogHttpJson(
      c,
      await http().list({
        includeArchived: query.includeArchived === "1",
        limit: query.limit,
        offset: query.offset,
        ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
        ...(query.q ? { q: query.q } : {}),
      }),
    );
  });

  r.get("/:id", zValidator("param", venueIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    return respondCatalogHttpJson(c, await http().get({ id }));
  });

  r.post("/", zValidator("json", createVenueSchema), async (c) => {
    const actorUserId = c.get("userId") as string;
    const body = c.req.valid("json");
    return respondCatalogHttpJson(c, await http().create({ actorUserId, body }));
  });

  r.patch(
    "/:id",
    zValidator("param", venueIdParamSchema),
    zValidator("json", updateVenueSchema),
    async (c) => {
      const actorUserId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      return respondCatalogHttpJson(c, await http().update({ actorUserId, id, body }));
    },
  );

  r.post("/:id/archive", zValidator("param", venueIdParamSchema), async (c) => {
    const actorUserId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    return respondCatalogHttpJson(c, await http().archive({ actorUserId, id }));
  });

  return r;
}
