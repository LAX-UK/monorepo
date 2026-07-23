import {
  attachSaleDocumentBodySchema,
  entityDocumentIdParamSchema,
  saleDocumentsSaleIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerSaleDocumentRoutesSlice } from "../container.js";
import {
  complianceViewerFromContext,
  respondComplianceHttpJson,
} from "../lib/compliance-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireSpecialistCatalogueOrAuctionManage } from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const saleDocDeleteParams = saleDocumentsSaleIdParamSchema.merge(entityDocumentIdParamSchema);

export function createSaleDocumentRoutes(
  container: ContainerSaleDocumentRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const saleDocumentHttp = container.compliance.saleDocumentHttp;

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.use("*", requireAuth, requireSpecialistCatalogueOrAuctionManage);

  r.get("/:saleId/documents", zValidator("param", saleDocumentsSaleIdParamSchema), async (c) => {
    const { saleId } = c.req.valid("param");
    const response = await saleDocumentHttp.list(saleId);
    return respondComplianceHttpJson(c, response);
  });

  r.post(
    "/:saleId/documents",
    zValidator("param", saleDocumentsSaleIdParamSchema),
    zValidator("json", attachSaleDocumentBodySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await saleDocumentHttp.attach({
        saleId,
        body,
        viewer: complianceViewerFromContext(c),
      });
      return respondComplianceHttpJson(c, response);
    },
  );

  r.delete(
    "/:saleId/documents/:documentId",
    zValidator("param", saleDocDeleteParams),
    async (c) => {
      const { saleId, documentId } = c.req.valid("param");
      const response = await saleDocumentHttp.remove(saleId, documentId);
      return respondComplianceHttpJson(c, response);
    },
  );

  return r;
}
