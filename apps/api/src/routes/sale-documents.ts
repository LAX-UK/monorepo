import {
  attachSaleDocumentBodySchema,
  entityDocumentIdParamSchema,
  saleDocumentsSaleIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerSaleDocumentRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireSpecialistCatalogueOrAuctionManage } from "../middleware/require-capability.js";
import { EntityDocumentError } from "../services/entity-document.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const saleDocDeleteParams = saleDocumentsSaleIdParamSchema.merge(entityDocumentIdParamSchema);

export function createSaleDocumentRoutes(
  container: ContainerSaleDocumentRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.use("*", requireAuth, requireSpecialistCatalogueOrAuctionManage);

  r.get("/:saleId/documents", zValidator("param", saleDocumentsSaleIdParamSchema), async (c) => {
    const { saleId } = c.req.valid("param");
    const data = await container.saleDocumentService.list(saleId);
    return c.json({ data });
  });

  r.post(
    "/:saleId/documents",
    zValidator("param", saleDocumentsSaleIdParamSchema),
    zValidator("json", attachSaleDocumentBodySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      try {
        const doc = await container.saleDocumentService.attach({
          entityId: saleId,
          kind: body.kind,
          label: body.label ?? null,
          uploadObjectId: body.uploadObjectId,
          userId,
        });
        return c.json({ data: doc }, 201);
      } catch (e) {
        if (e instanceof EntityDocumentError && e.code === "upload_not_active") {
          return c.json({ error: e.code }, 400);
        }
        throw e;
      }
    },
  );

  r.delete(
    "/:saleId/documents/:documentId",
    zValidator("param", saleDocDeleteParams),
    async (c) => {
      const { saleId, documentId } = c.req.valid("param");
      await container.saleDocumentService.remove(saleId, documentId);
      return c.body(null, 204);
    },
  );

  return r;
}
