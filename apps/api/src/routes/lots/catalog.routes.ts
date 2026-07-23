import {
  archiveCountQuerySchema,
  archiveSummaryQuerySchema,
  listLotsQuerySchema,
} from "@auction/validators";
import type { ContainerLotReadRoutesSlice } from "../../container.js";
import { respondCatalogHttpJson } from "../../lib/catalog-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { LotHono, LotReadRouteDeps } from "./_shared.js";

function viewerFromContext(c: {
  get: (key: "userId" | "userRole" | "userStaffRole") => string | null | undefined;
}) {
  return {
    userId: c.get("userId"),
    role: c.get("userRole"),
    staffRole: c.get("userStaffRole") ?? null,
  };
}

export function attachLotCatalogRoutes(r: LotHono, deps: LotReadRouteDeps): void {
  const lotReadHttp = deps.container.catalogRoutes.lotReadHttp;

  r.get("/", deps.optionalAuth, zValidator("query", listLotsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const response = await lotReadHttp.listLots({ query, viewer: viewerFromContext(c) });
    return respondCatalogHttpJson(c, response);
  });

  r.get("/archive/summary", zValidator("query", archiveSummaryQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const response = await lotReadHttp.archiveSummary({ endYear: q.endYear });
    return respondCatalogHttpJson(c, response);
  });

  r.get("/archive/count", zValidator("query", archiveCountQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const response = await lotReadHttp.archiveCount({
      categoryId: q.categoryId,
      categoryIds: q.categoryIds,
      endYear: q.endYear,
    });
    return respondCatalogHttpJson(c, response);
  });

  r.get("/count", deps.optionalAuth, zValidator("query", listLotsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const response = await lotReadHttp.countLots({ query, viewer: viewerFromContext(c) });
    return respondCatalogHttpJson(c, response);
  });
}

export type LotCatalogReadContainer = Pick<ContainerLotReadRoutesSlice, "catalogRoutes">;
