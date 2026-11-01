import { Hono } from "hono";
import type { ContainerOrganisationSecurityRoutesSlice } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };

/**
 * Security actions for the acting organisation. Mounted under `/legal-entities`; the organisation
 * comes from the context header and the service decides who may act.
 */
export function createOrganisationSecurityRoutes(
  container: ContainerOrganisationSecurityRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { twoStepReminders } = container.organisationSecurity;
  const r = new Hono<{ Variables: Variables }>();

  /** Emails the members without two-step on; once a day per organisation. */
  r.post("/two-step-reminders", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const result = await twoStepReminders.remind({
      userId: ctx.userId,
      legalEntityId: ctx.legalEntityId,
      role: ctx.role,
      isImpersonation: ctx.isImpersonation,
    });
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.code, message: e.message }, e.status),
    );
  });

  return r;
}
