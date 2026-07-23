import {
  attachLotDocumentBodySchema,
  entityDocumentIdParamSchema,
  lotDocumentsLotIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerLotDocumentRoutesSlice } from "../container.js";
import {
  complianceViewerFromContext,
  respondComplianceHttpJson,
} from "../lib/compliance-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireSpecialistCatalogueOrAuctionManage } from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const lotDocDeleteParams = lotDocumentsLotIdParamSchema.merge(entityDocumentIdParamSchema);

export function createLotDocumentRoutes(
  container: ContainerLotDocumentRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const lotDocumentHttp = container.compliance.lotDocumentHttp;

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.use("*", requireAuth, requireSpecialistCatalogueOrAuctionManage);

  r.get("/:lotId/documents", zValidator("param", lotDocumentsLotIdParamSchema), async (c) => {
    const { lotId } = c.req.valid("param");
    const response = await lotDocumentHttp.list(lotId);
    return respondComplianceHttpJson(c, response);
  });

  r.post(
    "/:lotId/documents",
    zValidator("param", lotDocumentsLotIdParamSchema),
    zValidator("json", attachLotDocumentBodySchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await lotDocumentHttp.attach({
        lotId,
        body,
        viewer: complianceViewerFromContext(c),
      });
      return respondComplianceHttpJson(c, response);
    },
  );

  r.delete("/:lotId/documents/:documentId", zValidator("param", lotDocDeleteParams), async (c) => {
    const { lotId, documentId } = c.req.valid("param");
    const response = await lotDocumentHttp.remove(lotId, documentId);
    return respondComplianceHttpJson(c, response);
  });

  return r;
}
