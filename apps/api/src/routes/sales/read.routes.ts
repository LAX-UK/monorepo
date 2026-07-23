import {
  listSaleBiddersQuerySchema,
  listSaleLotsQuerySchema,
  listSalesQuerySchema,
  saleIdParamSchema,
} from "@auction/validators";
import { respondCatalogHttpJson } from "../../lib/catalog-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { SaleHono, SaleReadRouteDeps } from "./_shared.js";

function viewerFromContext(c: {
  get: (key: "userId" | "userRole" | "userStaffRole") => string | null | undefined;
}) {
  return {
    userId: c.get("userId"),
    role: c.get("userRole"),
    staffRole: c.get("userStaffRole") ?? null,
  };
}

export function attachSaleReadRoutes(r: SaleHono, deps: SaleReadRouteDeps): void {
  const saleReadHttp = deps.container.catalogRoutes.saleReadHttp;
  const { optionalAuth, requireAuth } = deps;

  r.get("/", optionalAuth, zValidator("query", listSalesQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const response = await saleReadHttp.listSales({ query, viewer: viewerFromContext(c) });
    return respondCatalogHttpJson(c, response);
  });

  r.get("/:id/saleroom/status", zValidator("param", saleIdParamSchema), async (c) => {
    const { id: saleId } = c.req.valid("param");
    const response = await saleReadHttp.getSaleroomStatus({ saleId });
    return respondCatalogHttpJson(c, response);
  });

  r.get("/:id", optionalAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const response = await saleReadHttp.getSaleDetail({ saleId: id, viewer: viewerFromContext(c) });
    return respondCatalogHttpJson(c, response);
  });

  r.get("/:id/catalog-admin", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const response = await saleReadHttp.getCatalogAdminDetail({
      saleId: id,
      viewer: viewerFromContext(c),
    });
    return respondCatalogHttpJson(c, response);
  });

  r.get(
    "/:id/lots",
    optionalAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("query", listSaleLotsQuerySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const q = c.req.valid("query");
      const response = await saleReadHttp.listSaleLotsPage({
        saleId: id,
        query: q,
        viewer: viewerFromContext(c),
      });
      return respondCatalogHttpJson(c, response);
    },
  );

  r.get(
    "/:id/bidders",
    zValidator("param", saleIdParamSchema),
    zValidator("query", listSaleBiddersQuerySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const q = c.req.valid("query");
      const response = await saleReadHttp.listSaleBidders({ saleId: id, query: q });
      return respondCatalogHttpJson(c, response);
    },
  );
}
