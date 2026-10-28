import { type Context, Hono } from "hono";
import type { Result } from "neverthrow";
import { z } from "zod";
import type { ContainerOrganisationMembershipRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type {
  OrganisationMemberActor,
  OrganisationMembershipError,
} from "../services/interfaces/organisation-membership-service.js";

const cancelBodySchema = z.object({
  kind: z.enum(["auto_bid", "absentee"]),
  id: z.string().uuid(),
  memberUserId: z.string().min(1).max(200),
});

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
 * The signed-in member's own welcome card, and the bids former members left standing for the
 * acting organisation. Mounted under `/legal-entities`; the organisation comes from the context
 * header and the member's role decides what they may do.
 */
export function createOrganisationMembershipRoutes(
  container: ContainerOrganisationMembershipRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { welcome, formerMemberBids } = container.organisationMembership;
  const r = new Hono<{ Variables: Variables }>();

  r.post("/membership/welcome-dismissal", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    return respond(c, await welcome.dismiss(actorFrom(ctx)));
  });

  r.get("/former-member-bids", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    return respond(c, await formerMemberBids.list(actorFrom(ctx)));
  });

  r.post(
    "/former-member-bids/cancel",
    requireAuth,
    requireContext,
    zValidator("json", cancelBodySchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      return respond(c, await formerMemberBids.cancel(actorFrom(ctx), c.req.valid("json")));
    },
  );

  return r;
}
