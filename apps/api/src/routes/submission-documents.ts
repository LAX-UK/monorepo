import {
  attachSubmissionDocumentBodySchema,
  entityDocumentIdParamSchema,
  submissionDocumentsSubmissionIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerSubmissionDocumentRoutesSlice } from "../container.js";
import { respondSubmissionHttpJson } from "../lib/submission-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireSubmissionsAccess } from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { viewerFromContext } from "./submissions/_shared.js";

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
  const documentHttp = container.submissionRoutes.documentHttp;

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.use("*", requireAuth, requireSubmissionsAccess);

  r.get(
    "/:submissionId/documents",
    zValidator("param", submissionDocumentsSubmissionIdParamSchema),
    async (c) => {
      const { submissionId } = c.req.valid("param");
      const response = await documentHttp.listForStaff({
        submissionId,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:submissionId/documents",
    zValidator("param", submissionDocumentsSubmissionIdParamSchema),
    zValidator("json", attachSubmissionDocumentBodySchema),
    async (c) => {
      const { submissionId } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await documentHttp.attachForStaff({
        submissionId,
        body,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.delete(
    "/:submissionId/documents/:documentId",
    zValidator("param", submissionDocDeleteParams),
    async (c) => {
      const { submissionId, documentId } = c.req.valid("param");
      const response = await documentHttp.removeForStaff({
        submissionId,
        documentId,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  return r;
}
