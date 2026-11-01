import { submissionRoleRefusal } from "@auction/domain";
import { postConsignmentMessageBodySchema, submissionIdParamSchema } from "@auction/validators";
import { respondSubmissionHttpJson } from "../../lib/submission-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireEntityCapability } from "../../middleware/require-entity-capability.js";
import {
  type SubmissionHono,
  type SubmissionRouteDeps,
  legalEntityFromContext,
} from "./_shared.js";

/**
 * A consignment's messages for the account that sent it. Who reads and who writes is the
 * thread's access rule in the application service; the capability gate only turns away the
 * roles that may write on no consignment at all.
 */
export function attachConsignmentMessageRoutes(r: SubmissionHono, deps: SubmissionRouteDeps): void {
  const { container, requireAuth, requireSubmissionEntityContext } = deps;
  const messageHttp = container.submissionRoutes.messageHttp;
  const requireWriteMessages = requireEntityCapability(
    "entity.submissions.create",
    submissionRoleRefusal("message"),
  );

  r.get(
    "/:id/messages",
    requireAuth,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const response = await messageHttp.listForClient({
        submissionId: id,
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/messages",
    requireAuth,
    requireSubmissionEntityContext,
    requireWriteMessages,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", postConsignmentMessageBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const response = await messageHttp.postForClient({
        submissionId: id,
        body: c.req.valid("json"),
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );

  r.post(
    "/:id/messages/read",
    requireAuth,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const response = await messageHttp.markReadForClient({
        submissionId: id,
        legalEntity: legalEntityFromContext(c),
      });
      return respondSubmissionHttpJson(c, response);
    },
  );
}
