import type { StaffRoles } from "@auction/types";
import {
  consignmentInboxBulkBodySchema,
  consignmentInboxListQuerySchema,
  consignmentThreadAssignBodySchema,
  consignmentThreadMessageParamSchema,
  consignmentThreadReplyBodySchema,
  consignmentThreadSubmissionParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerSubmissionDocumentRoutesSlice } from "../container.js";
import { respondSubmissionHttpJson } from "../lib/submission-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requireConsignmentInboxRead,
  requireConsignmentInboxReply,
} from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { viewerFromContext } from "./submissions/_shared.js";

/**
 * The staff inbox for consignment messages: threads across consignments, the numbers behind its
 * tabs, one thread, replying and taking a reply back, closing, assigning and marking read. Reads
 * need the inbox read access; every change needs the reply access. The fixed paths come before
 * `/:submissionId` so they are never taken for a consignment.
 */
export function createAdminConsignmentThreadRoutes(
  container: ContainerSubmissionDocumentRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const messageHttp = container.submissionRoutes.messageHttp;
  const threadParam = zValidator("param", consignmentThreadSubmissionParamSchema);

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();

  r.use("*", requireAuth);

  r.get(
    "/",
    requireConsignmentInboxRead,
    zValidator("query", consignmentInboxListQuerySchema),
    async (c) =>
      respondSubmissionHttpJson(
        c,
        await messageHttp.listThreads({
          query: c.req.valid("query"),
          viewer: viewerFromContext(c),
        }),
      ),
  );

  r.get("/summary", requireConsignmentInboxRead, async (c) =>
    respondSubmissionHttpJson(c, await messageHttp.summary({ viewer: viewerFromContext(c) })),
  );

  r.get("/assignees", requireConsignmentInboxRead, async (c) =>
    respondSubmissionHttpJson(c, await messageHttp.assignees({ viewer: viewerFromContext(c) })),
  );

  r.post(
    "/bulk",
    requireConsignmentInboxReply,
    zValidator("json", consignmentInboxBulkBodySchema),
    async (c) =>
      respondSubmissionHttpJson(
        c,
        await messageHttp.bulk({ body: c.req.valid("json"), viewer: viewerFromContext(c) }),
      ),
  );

  r.get("/:submissionId", requireConsignmentInboxRead, threadParam, async (c) =>
    respondSubmissionHttpJson(
      c,
      await messageHttp.getForStaff({
        submissionId: c.req.valid("param").submissionId,
        viewer: viewerFromContext(c),
      }),
    ),
  );

  r.post(
    "/:submissionId/messages",
    requireConsignmentInboxReply,
    threadParam,
    zValidator("json", consignmentThreadReplyBodySchema),
    async (c) =>
      respondSubmissionHttpJson(
        c,
        await messageHttp.replyForStaff({
          submissionId: c.req.valid("param").submissionId,
          body: c.req.valid("json"),
          viewer: viewerFromContext(c),
        }),
      ),
  );

  r.delete(
    "/:submissionId/messages/:messageId",
    requireConsignmentInboxReply,
    zValidator("param", consignmentThreadMessageParamSchema),
    async (c) => {
      const { submissionId, messageId } = c.req.valid("param");
      return respondSubmissionHttpJson(
        c,
        await messageHttp.undoReply({ submissionId, messageId, viewer: viewerFromContext(c) }),
      );
    },
  );

  r.post(
    "/:submissionId/assign",
    requireConsignmentInboxReply,
    threadParam,
    zValidator("json", consignmentThreadAssignBodySchema),
    async (c) =>
      respondSubmissionHttpJson(
        c,
        await messageHttp.assignForStaff({
          submissionId: c.req.valid("param").submissionId,
          body: c.req.valid("json"),
          viewer: viewerFromContext(c),
        }),
      ),
  );

  r.post("/:submissionId/close", requireConsignmentInboxReply, threadParam, async (c) =>
    respondSubmissionHttpJson(
      c,
      await messageHttp.closeThread({
        submissionId: c.req.valid("param").submissionId,
        viewer: viewerFromContext(c),
      }),
    ),
  );

  r.post("/:submissionId/reopen", requireConsignmentInboxReply, threadParam, async (c) =>
    respondSubmissionHttpJson(
      c,
      await messageHttp.reopenThread({
        submissionId: c.req.valid("param").submissionId,
        viewer: viewerFromContext(c),
      }),
    ),
  );

  r.post("/:submissionId/read", requireConsignmentInboxReply, threadParam, async (c) =>
    respondSubmissionHttpJson(
      c,
      await messageHttp.markReadForStaff({
        submissionId: c.req.valid("param").submissionId,
        viewer: viewerFromContext(c),
      }),
    ),
  );

  r.post("/:submissionId/unread", requireConsignmentInboxReply, threadParam, async (c) =>
    respondSubmissionHttpJson(
      c,
      await messageHttp.markUnreadForStaff({
        submissionId: c.req.valid("param").submissionId,
        viewer: viewerFromContext(c),
      }),
    ),
  );

  return r;
}
