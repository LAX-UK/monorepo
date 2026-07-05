import {
  attachSubmissionDocumentBodySchema,
  entityDocumentIdParamSchema,
  submissionDocumentsSubmissionIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerSubmissionDocumentRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireSpecialistCatalogueOrAuctionManage } from "../middleware/require-capability.js";
import { EntityDocumentError } from "../services/entity-document.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const submissionDocDeleteParams = submissionDocumentsSubmissionIdParamSchema.merge(
  entityDocumentIdParamSchema,
);

export function createSubmissionDocumentRoutes(
  container: ContainerSubmissionDocumentRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.use("*", requireAuth, requireSpecialistCatalogueOrAuctionManage);

  r.get(
    "/:submissionId/documents",
    zValidator("param", submissionDocumentsSubmissionIdParamSchema),
    async (c) => {
      const { submissionId } = c.req.valid("param");
      const data = await container.submissionDocumentService.list(submissionId);
      return c.json({ data });
    },
  );

  r.post(
    "/:submissionId/documents",
    zValidator("param", submissionDocumentsSubmissionIdParamSchema),
    zValidator("json", attachSubmissionDocumentBodySchema),
    async (c) => {
      const { submissionId } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      try {
        const doc = await container.submissionDocumentService.attach({
          entityId: submissionId,
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
    "/:submissionId/documents/:documentId",
    zValidator("param", submissionDocDeleteParams),
    async (c) => {
      const { submissionId, documentId } = c.req.valid("param");
      await container.submissionDocumentService.remove(submissionId, documentId);
      return c.body(null, 204);
    },
  );

  return r;
}
