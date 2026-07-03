import type { ContainerAdminRoutesSlice } from "../../container.js";
import type { AdminLegalEntityBrowseParams } from "../../lib/admin-legal-entity-browse.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireLegalEntityBrowse,
  requireVenuesAccess,
} from "../../middleware/require-capability.js";
import { adminLegalEntityBrowseQuerySchema } from "./_schemas.js";
import type { AdminHono } from "./_shared.js";

const requireLegalEntityRead = requireLegalEntityBrowse;

export function attachAdminLotsCatalogRoutes(
  platform: AdminHono,
  container: ContainerAdminRoutesSlice,
): void {
  platform.get("/platform-catalog/legal-entity-id", requireVenuesAccess, async (c) => {
    const id = await container.admin.catalog.resolvePlatformCatalogLegalEntityId();
    return c.json({ data: { id } });
  });

  platform.get(
    "/legal-entities/browse",
    requireLegalEntityRead,
    zValidator("query", adminLegalEntityBrowseQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const input: AdminLegalEntityBrowseParams = {
        limit: query.limit,
        offset: query.offset,
      };
      const trimmed = query.q?.trim();
      if (trimmed) input.q = trimmed;
      if (query.createdByUserId) input.createdByUserId = query.createdByUserId;
      if (query.status) input.status = query.status;
      if (query.kind) input.kind = query.kind;
      if (query.stripeDue === "1") input.stripeDue = true;
      const data = await container.admin.dashboard.searchLegalEntitiesBrowse(input);
      return c.json({ data });
    },
  );
}
