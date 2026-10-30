import { accountSearchQuerySchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerOrganisationWorkspaceRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { OrganisationMemberActor } from "../services/interfaces/organisation-membership-service.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };

function memberActor(ctx: LegalEntityContext): OrganisationMemberActor {
  return {
    userId: ctx.userId,
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}

/**
 * Reads across the client workspace for the acting account (the context header), each narrowed
 * to what the member's role may open. Mounted under `/legal-entities`.
 */
export function createOrganisationWorkspaceRoutes(
  container: ContainerOrganisationWorkspaceRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const { search } = container.organisationWorkspace;
  const r = new Hono<{ Variables: Variables }>();

  /** Records in the acting account by title, artist, lot number, invoice number or person. */
  r.get(
    "/search",
    requireAuth,
    container.requireLegalEntityContext,
    zValidator("query", accountSearchQuerySchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const result = await search.search(memberActor(ctx), c.req.valid("query"));
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.code, message: e.message }, e.status),
      );
    },
  );

  return r;
}
