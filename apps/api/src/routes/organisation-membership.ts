import { type Context, Hono } from "hono";
import type { Result } from "neverthrow";
import type { ContainerOrganisationMembershipRoutesSlice } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type {
  OrganisationMemberActor,
  OrganisationMembershipError,
} from "../services/interfaces/organisation-membership-service.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };

function actorFrom(ctx: LegalEntityContext): OrganisationMemberActor {
  return {
    userId: ctx.userId,
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}

function respond<T>(c: Context, result: Result<T, OrganisationMembershipError>) {
  return result.match(
    (data) => c.json({ data: data ?? null }),
    (e) => c.json({ error: e.code, message: e.message }, e.status),
  );
}

/**
 * The signed-in member's own welcome card, and the automatic bids that stopped when members left
 * the acting organisation. Mounted under `/legal-entities`; the organisation comes from the
 * context header and the member's role decides what they may see.
 */
export function createOrganisationMembershipRoutes(
  container: ContainerOrganisationMembershipRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { welcome, stoppedMemberBids } = container.organisationMembership;
  const r = new Hono<{ Variables: Variables }>();

  r.post("/membership/welcome-dismissal", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    return respond(c, await welcome.dismiss(actorFrom(ctx)));
  });

  r.get("/stopped-member-bids", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    return respond(c, await stoppedMemberBids.listRecent(actorFrom(ctx)));
  });

  return r;
}
