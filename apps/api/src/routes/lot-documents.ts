import {
  attachLotDocumentBodySchema,
  entityDocumentIdParamSchema,
  lotDocumentsLotIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireSpecialistCatalogueOrAuctionManage } from "../middleware/require-capability.js";
import { EntityDocumentError } from "../services/entity-document.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const lotDocDeleteParams = lotDocumentsLotIdParamSchema.merge(entityDocumentIdParamSchema);

export function createLotDocumentRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.use("*", requireAuth, requireSpecialistCatalogueOrAuctionManage);

  r.get("/:lotId/documents", zValidator("param", lotDocumentsLotIdParamSchema), async (c) => {
    const { lotId } = c.req.valid("param");
    const data = await container.lotDocumentService.list(lotId);
    return c.json({ data });
  });

  r.post(
    "/:lotId/documents",
    zValidator("param", lotDocumentsLotIdParamSchema),
    zValidator("json", attachLotDocumentBodySchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      try {
        const doc = await container.lotDocumentService.attach({
          entityId: lotId,
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

  r.delete("/:lotId/documents/:documentId", zValidator("param", lotDocDeleteParams), async (c) => {
    const { lotId, documentId } = c.req.valid("param");
    await container.lotDocumentService.remove(lotId, documentId);
    return c.body(null, 204);
  });

  return r;
}
