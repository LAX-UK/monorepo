import {
  adminAssignSubmissionBodySchema,
  adminBulkSubmissionsBodySchema,
  approveSubmissionBodySchema,
  listSubmissionsQuerySchema,
  rejectSubmissionBodySchema,
  submissionIdParamSchema,
} from "@auction/validators";
import { respondSubmissionHttpJson } from "../../lib/submission-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireSubmissionsAccess } from "../../middleware/require-capability.js";
import { type SubmissionHono, type SubmissionRouteDeps, viewerFromContext } from "./_shared.js";

export function attachSubmissionAdminRoutes(r: SubmissionHono, deps: SubmissionRouteDeps): void {
  const { container, requireAuth } = deps;
  const adminHttp = container.submissionRoutes.adminHttp;

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
    zValidator("json", approveSubmissionBodySchema),
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
