import { Hono } from "hono";
import type { ContainerOrganisationHomeRoutesSlice } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };

/**
 * The business figures on the acting organisation's Home. Mounted under `/legal-entities`; the
 * organisation comes from the context header and the member's role decides which figures exist.
 */
export function createOrganisationHomeRoutes(
  container: ContainerOrganisationHomeRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const { dashboard } = container.organisationHome;
  const r = new Hono<{ Variables: Variables }>();

  r.get("/home/dashboard", requireAuth, container.requireLegalEntityContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const figures = await dashboard.figures({
      userId: ctx.userId,
      legalEntityId: ctx.legalEntityId,
      role: ctx.role,
      isImpersonation: ctx.isImpersonation,
    });
    return c.json({ data: figures });
  });

  return r;
}
