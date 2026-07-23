import {
  checkOrgNameSchema,
  createOrganizationSchema,
  orgRequirementsParamsSchema,
} from "@auction/validators";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import type { ContainerOrganizationRoutesSlice } from "../container.js";
import { respondIdentityRouteOutcome } from "../lib/identity-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createOrganizationOnboardingRoutes } from "./organization-onboarding.js";

export function createOrganizationRoutes(
  container: ContainerOrganizationRoutesSlice,
  authenticator: IAuthenticator,
  orgCreateRateLimit: MiddlewareHandler,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const organizationHttp = container.identityRoutes.organizationHttp;
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.get("/subkinds", (c) => {
    return respondIdentityRouteOutcome(c, organizationHttp.listSubkinds());
  });

  r.get("/requirements/:subkind", zValidator("param", orgRequirementsParamsSchema), (c) => {
    const { subkind } = c.req.valid("param");
    return respondIdentityRouteOutcome(c, organizationHttp.getRequirements({ subkind }));
  });

  r.get("/check-name", zValidator("query", checkOrgNameSchema), async (c) => {
    const { displayName } = c.req.valid("query");
    const outcome = await organizationHttp.checkNameAvailability({ displayName });
    return respondIdentityRouteOutcome(c, outcome);
  });

  r.post(
    "/",
    requireAuth,
    orgCreateRateLimit,
    zValidator("json", createOrganizationSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const outcome = await organizationHttp.createOrganization({ userId, body });
      if (outcome.kind === "err") {
        return respondIdentityRouteOutcome(c, outcome);
      }
      return respondIdentityRouteOutcome(c, outcome, 201);
    },
  );

  r.route("/:entityId/onboarding", createOrganizationOnboardingRoutes(container, authenticator));

  return r;
}
