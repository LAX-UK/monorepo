import { setOrganisationBiddingLimitSchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerLegalEntityBuyerAgentRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { BuyerAgentManager } from "../services/interfaces/buyer-agent-authorisation-service.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };

function memberActor(ctx: LegalEntityContext): BuyerAgentManager {
  return {
    kind: "member",
    userId: ctx.userId,
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}

/**
 * The acting organisation's bidding limits: the organisation-wide limit and each buyer agent's
 * total, with what is in use under them. Everyone who bids for the organisation can read them;
 * owners and admins set or remove the organisation limit. Mounted under `/legal-entities`.
 */
export function createLegalEntityBiddingLimitRoutes(
  container: ContainerLegalEntityBuyerAgentRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { limits } = container.buyerAgents;
  const r = new Hono<{ Variables: Variables }>();

  r.get("/bidding-limits", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const result = await limits.view(memberActor(ctx), ctx.legalEntityId);
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.code, message: e.message }, e.status),
    );
  });

  r.put(
    "/bidding-limits/organisation",
    requireAuth,
    requireContext,
    zValidator("json", setOrganisationBiddingLimitSchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const result = await limits.setOrganisationLimit(
        memberActor(ctx),
        ctx.legalEntityId,
        c.req.valid("json"),
      );
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.code, message: e.message }, e.status),
      );
    },
  );

  return r;
}
