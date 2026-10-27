import {
  authoriseBuyerAgentSchema,
  revokeBuyerAgentAuthorisationSchema,
} from "@auction/validators";
import { type Context, Hono } from "hono";
import type { Result } from "neverthrow";
import { z } from "zod";
import type { ContainerLegalEntityBuyerAgentRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type {
  BuyerAgentAuthorisationError,
  BuyerAgentManager,
} from "../services/interfaces/buyer-agent-authorisation-service.js";

const authorisationIdParam = z.object({ authorisationId: z.string().uuid() });
const bidAuthorityQuery = z.object({ saleId: z.string().uuid().optional() });

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };

function memberManager(ctx: LegalEntityContext): BuyerAgentManager {
  return {
    kind: "member",
    userId: ctx.userId,
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}

export function respondBuyerAgentResult<T>(
  c: Context,
  result: Result<T, BuyerAgentAuthorisationError>,
  okStatus: 200 | 201 = 200,
) {
  return result.match(
    (data) => c.json({ data }, okStatus),
    (e) => c.json({ error: e.code, message: e.message }, e.status),
  );
}

/**
 * The acting organisation's buyer agents (owners and admins authorise them to bid, for all sales
 * or one, with a limit and dates) and the signed-in member's own "may I bid here?" answer.
 * Mounted under `/legal-entities`; the acting legal entity comes from the context header.
 */
export function createLegalEntityBuyerAgentRoutes(
  container: ContainerLegalEntityBuyerAgentRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { authorisations, bidAuthority } = container.buyerAgents;
  const r = new Hono<{ Variables: Variables }>();

  r.get("/buyer-agent-authorisations", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    return respondBuyerAgentResult(
      c,
      await authorisations.overview(memberManager(ctx), ctx.legalEntityId),
    );
  });

  r.post(
    "/buyer-agent-authorisations",
    requireAuth,
    requireContext,
    zValidator("json", authoriseBuyerAgentSchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const result = await authorisations.authorise(
        memberManager(ctx),
        ctx.legalEntityId,
        c.req.valid("json"),
      );
      return respondBuyerAgentResult(c, result, 201);
    },
  );

  r.post(
    "/buyer-agent-authorisations/:authorisationId/revoke",
    requireAuth,
    requireContext,
    zValidator("param", authorisationIdParam),
    zValidator("json", revokeBuyerAgentAuthorisationSchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const { authorisationId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const result = await authorisations.revoke(
        memberManager(ctx),
        ctx.legalEntityId,
        authorisationId,
        reason,
      );
      return respondBuyerAgentResult(c, result);
    },
  );

  r.get(
    "/bid-authority",
    requireAuth,
    requireContext,
    zValidator("query", bidAuthorityQuery),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const { saleId } = c.req.valid("query");
      const data = await bidAuthority.forSale({
        userId: c.get("userId") as string,
        legalEntityId: ctx.legalEntityId,
        saleId: saleId ?? null,
      });
      return c.json({ data });
    },
  );

  return r;
}
