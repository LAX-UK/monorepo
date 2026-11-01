import type { StaffRoles } from "@auction/types";
import { savedReplyBodySchema, savedReplyParamSchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerSubmissionDocumentRoutesSlice } from "../container.js";
import { respondSubmissionHttpJson } from "../lib/submission-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requireConsignmentInboxRead,
  requireSavedRepliesManage,
} from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { viewerFromContext } from "./submissions/_shared.js";

/**
 * The team's saved replies for the consignment inbox: everyone who reads the inbox lists them;
 * sales managers and administrators write and retire them.
 */
export function createAdminConsignmentSavedReplyRoutes(
  container: ContainerSubmissionDocumentRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const savedReplyHttp = container.submissionRoutes.savedReplyHttp;

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();

  r.use("*", requireAuth);

  r.get("/", requireConsignmentInboxRead, async (c) =>
    respondSubmissionHttpJson(c, await savedReplyHttp.list({ viewer: viewerFromContext(c) })),
  );

  r.post("/", requireSavedRepliesManage, zValidator("json", savedReplyBodySchema), async (c) =>
    respondSubmissionHttpJson(
      c,
      await savedReplyHttp.create({ body: c.req.valid("json"), viewer: viewerFromContext(c) }),
    ),
  );

  r.patch(
    "/:id",
    requireSavedRepliesManage,
    zValidator("param", savedReplyParamSchema),
    zValidator("json", savedReplyBodySchema),
    async (c) =>
      respondSubmissionHttpJson(
        c,
        await savedReplyHttp.update({
          id: c.req.valid("param").id,
          body: c.req.valid("json"),
          viewer: viewerFromContext(c),
        }),
      ),
  );

  r.delete(
    "/:id",
    requireSavedRepliesManage,
    zValidator("param", savedReplyParamSchema),
    async (c) =>
      respondSubmissionHttpJson(
        c,
        await savedReplyHttp.remove({
          id: c.req.valid("param").id,
          viewer: viewerFromContext(c),
        }),
      ),
  );

  return r;
}
