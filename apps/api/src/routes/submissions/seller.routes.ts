import {
  attachSubmissionDocumentBodySchema,
  createItemSubmissionSchema,
  entityDocumentIdParamSchema,
  listSubmissionsQuerySchema,
  submissionIdParamSchema,
} from "@auction/validators";
import { respondSubmissionHttpJson } from "../../lib/submission-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireBuyerRole,
  requireBuyerRoleUnlessStaff,
} from "../../middleware/require-buyer-role.js";
import {
  type SubmissionHono,
  type SubmissionRouteDeps,
  legalEntityFromContext,
  viewerFromContext,
} from "./_shared.js";

export function attachSubmissionSellerRoutes(r: SubmissionHono, deps: SubmissionRouteDeps): void {
  const { container, requireAuth, requireSubmissionEntityContext } = deps;
  const sellerHttp = container.submissionRoutes.sellerHttp;
  const documentHttp = container.submissionRoutes.documentHttp;

  r.post(
    "/",
    requireAuth,
    requireBuyerRole,
    requireSubmissionEntityContext,
    zValidator("json", createItemSubmissionSchema),
    async (c) => {
      const body = c.req.valid("json");
      const response = await sellerHttp.createDraft({
        body,
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.get(
    "/mine",
    requireAuth,
    requireSubmissionEntityContext,
    zValidator("query", listSubmissionsQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const response = await sellerHttp.listMine({
        query,
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.get("/mine/summary", requireAuth, requireSubmissionEntityContext, async (c) => {
    const response = await sellerHttp.getMineSummary({
      legalEntity: legalEntityFromContext(c),
    });
    return respondSubmissionHttpJson(c, response);
  });

  r.get(
    "/:id",
    requireAuth,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const response = await sellerHttp.getById({
        submissionId: id,
        viewer: viewerFromContext(c),
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.get(
    "/:id/documents",
    requireAuth,
    requireBuyerRoleUnlessStaff,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const response = await documentHttp.listForViewer({
        submissionId: id,
        viewer: viewerFromContext(c),
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/documents",
    requireAuth,
    requireBuyerRoleUnlessStaff,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", attachSubmissionDocumentBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await documentHttp.attachForViewer({
        submissionId: id,
        body,
        viewer: viewerFromContext(c),
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.delete(
    "/:id/documents/:documentId",
    requireAuth,
    requireBuyerRoleUnlessStaff,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema.merge(entityDocumentIdParamSchema)),
    async (c) => {
      const { id, documentId } = c.req.valid("param");
      const response = await documentHttp.removeForViewer({
        submissionId: id,
        documentId,
        viewer: viewerFromContext(c),
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.patch(
    "/:id",
    requireAuth,
    requireBuyerRoleUnlessStaff,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      let raw: unknown = {};
      try {
        raw = await c.req.json();
      } catch {
        raw = {};
      }
      const response = await sellerHttp.patch({
        submissionId: id,
        rawBody: raw,
        viewer: viewerFromContext(c),
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/submit",
    requireAuth,
    requireBuyerRole,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const response = await sellerHttp.submitForReview({
        submissionId: id,
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/withdraw",
    requireAuth,
    requireBuyerRole,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const response = await sellerHttp.withdraw({
        submissionId: id,
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );
}
