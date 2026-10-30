import {
  accessApproveBodySchema,
  accessAskBodySchema,
  accessDeclineBodySchema,
  accessRequestIdParamSchema,
  accessRequestListQuerySchema,
} from "@auction/validators";
import { type Context, Hono } from "hono";
import type { Result } from "neverthrow";
import type { ContainerOrganisationAccessRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { AccessRequestError } from "../services/interfaces/access-request-service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { OrganisationMemberActor } from "../services/interfaces/organisation-membership-service.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };
type AccessContext = Context<{ Variables: Variables }>;

function memberActor(c: AccessContext): OrganisationMemberActor {
  const ctx = c.get("legalEntityContext") as LegalEntityContext;
  return {
    userId: ctx.userId,
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}

function refused(c: AccessContext, e: AccessRequestError) {
  return c.json(
    { error: e.code, message: e.message, ...(e.hint ? { hint: e.hint } : {}) },
    e.status,
  );
}

function respond<T>(c: AccessContext, result: Result<T, AccessRequestError>) {
  return result.match(
    (data) => c.json({ data }),
    (e) => refused(c, e),
  );
}

/**
 * "Ask for access" for the acting organisation: members ask for a role or capability, owners
 * and admins approve or decline, and the requester can withdraw while it waits. Mounted under
 * `/legal-entities`; the account comes from the context header.
 */
export function createOrganisationAccessRequestRoutes(
  container: ContainerOrganisationAccessRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { accessRequests } = container.organisationAccess;
  const r = new Hono<{ Variables: Variables }>();

  r.post(
    "/access-requests",
    requireAuth,
    requireContext,
    zValidator("json", accessAskBodySchema),
    async (c) => {
      const result = await accessRequests.ask(memberActor(c), c.req.valid("json"));
      if (result.isErr()) return refused(c, result.error);
      // A repeated ask returns the pending request rather than opening another.
      return c.json({ data: result.value.request }, result.value.created ? 201 : 200);
    },
  );

  r.get(
    "/access-requests",
    requireAuth,
    requireContext,
    zValidator("query", accessRequestListQuerySchema),
    async (c) => respond(c, await accessRequests.list(memberActor(c), c.req.valid("query"))),
  );

  r.post(
    "/access-requests/:requestId/approve",
    requireAuth,
    requireContext,
    zValidator("param", accessRequestIdParamSchema),
    zValidator("json", accessApproveBodySchema),
    async (c) =>
      respond(
        c,
        await accessRequests.approve(
          memberActor(c),
          c.req.valid("param").requestId,
          c.req.valid("json"),
        ),
      ),
  );

  r.post(
    "/access-requests/:requestId/decline",
    requireAuth,
    requireContext,
    zValidator("param", accessRequestIdParamSchema),
    zValidator("json", accessDeclineBodySchema),
    async (c) =>
      respond(
        c,
        await accessRequests.decline(
          memberActor(c),
          c.req.valid("param").requestId,
          c.req.valid("json"),
        ),
      ),
  );

  r.post(
    "/access-requests/:requestId/withdraw",
    requireAuth,
    requireContext,
    zValidator("param", accessRequestIdParamSchema),
    async (c) =>
      respond(c, await accessRequests.withdraw(memberActor(c), c.req.valid("param").requestId)),
  );

  return r;
}
