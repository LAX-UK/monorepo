import type { StaffRoles } from "@auction/types";
import {
  adminAssignSubmissionBodySchema,
  consignmentThreadSubmissionParamSchema,
  postConsignmentMessageBodySchema,
  staffConsignmentThreadsQuerySchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerSubmissionDocumentRoutesSlice } from "../container.js";
import { respondSubmissionHttpJson } from "../lib/submission-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requireSubmissionsAccess,
  requireSubmissionsRead,
} from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { viewerFromContext } from "./submissions/_shared.js";

/**
 * The staff inbox for consignment messages: threads across consignments (waiting for an answer,
 * one specialist's, one sale's), one thread, replying, assigning the specialist and marking read.
 * Reading needs the submissions read access; writing the submissions access.
 */
export function createAdminConsignmentThreadRoutes(
  container: ContainerSubmissionDocumentRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const messageHttp = container.submissionRoutes.messageHttp;

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();

  r.use("*", requireAuth);

  r.get(
    "/",
    requireSubmissionsRead,
    zValidator("query", staffConsignmentThreadsQuerySchema),
    async (c) => {
      const response = await messageHttp.listThreads({
        query: c.req.valid("query"),
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.get(
    "/:submissionId",
    requireSubmissionsRead,
    zValidator("param", consignmentThreadSubmissionParamSchema),
    async (c) => {
      const { submissionId } = c.req.valid("param");
      const response = await messageHttp.getForStaff({
        submissionId,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:submissionId/messages",
    requireSubmissionsAccess,
    zValidator("param", consignmentThreadSubmissionParamSchema),
    zValidator("json", postConsignmentMessageBodySchema),
    async (c) => {
      const { submissionId } = c.req.valid("param");
      const response = await messageHttp.replyForStaff({
        submissionId,
        body: c.req.valid("json"),
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:submissionId/assign",
    requireSubmissionsAccess,
    zValidator("param", consignmentThreadSubmissionParamSchema),
    zValidator("json", adminAssignSubmissionBodySchema),
    async (c) => {
      const { submissionId } = c.req.valid("param");
      const response = await messageHttp.assignForStaff({
        submissionId,
        assignedToUserId: c.req.valid("json").assignedToUserId,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:submissionId/read",
    requireSubmissionsAccess,
    zValidator("param", consignmentThreadSubmissionParamSchema),
    async (c) => {
      const { submissionId } = c.req.valid("param");
      const response = await messageHttp.markReadForStaff({
        submissionId,
        viewer: viewerFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  return r;
}
