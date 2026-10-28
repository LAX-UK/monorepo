import {
  acceptSubmissionBodySchema,
  adminAssignSubmissionBodySchema,
  adminBulkSubmissionsBodySchema,
  approveSubmissionBodySchema,
  listSubmissionsQuerySchema,
  proposeConsignmentTermsBodySchema,
  rejectSubmissionBodySchema,
  requestSubmissionChangesBodySchema,
  submissionIdParamSchema,
  submissionIdsQuerySchema,
} from "@auction/validators";
import { respondSubmissionHttpJson } from "../../lib/submission-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireSubmissionsAccess } from "../../middleware/require-capability.js";
import { type SubmissionHono, type SubmissionRouteDeps, viewerFromContext } from "./_shared.js";

export function attachSubmissionAdminRoutes(r: SubmissionHono, deps: SubmissionRouteDeps): void {
  const { container, requireAuth } = deps;
  const adminHttp = container.submissionRoutes.adminHttp;
  const agreementHttp = container.submissionRoutes.agreementHttp;

  r.get(
    "/",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("query", listSubmissionsQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const response = await adminHttp.listSubmissions({
        query,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/review/start",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const response = await adminHttp.startReview({
        submissionId: id,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/bulk",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("json", adminBulkSubmissionsBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      const response = await adminHttp.bulkApproveOrReject({
        body,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/accept",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", acceptSubmissionBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await adminHttp.accept({
        submissionId: id,
        body,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.get(
    "/agreements/staff",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("query", submissionIdsQuerySchema),
    async (c) => {
      const { ids } = c.req.valid("query");
      const response = await agreementHttp.listForStaff(ids, viewerFromContext(c));
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/agreement/terms",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", proposeConsignmentTermsBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const terms = c.req.valid("json");
      const response = await agreementHttp.proposeTerms(id, terms, viewerFromContext(c));
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.get(
    "/:id/agreement/staff",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const response = await agreementHttp.getForStaff(id, viewerFromContext(c));
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/request-changes",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", requestSubmissionChangesBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await adminHttp.requestChanges({
        submissionId: id,
        body,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/convert",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", approveSubmissionBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await adminHttp.convert({
        submissionId: id,
        body,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/assign",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", adminAssignSubmissionBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await adminHttp.assign({
        submissionId: id,
        body,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/approve",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", approveSubmissionBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await adminHttp.approve({
        submissionId: id,
        body,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/reject",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", rejectSubmissionBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await adminHttp.reject({
        submissionId: id,
        body,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );
}
