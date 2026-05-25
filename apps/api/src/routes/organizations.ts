import {
  checkOrgNameSchema,
  createOrganizationSchema,
  orgRequirementsParamsSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createOrganizationOnboardingRoutes } from "./organization-onboarding.js";

export function createOrganizationRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  /** GET /organizations/subkinds — public list of subkinds available to public onboarding. */
  r.get("/subkinds", (c) => {
    return c.json({ data: container.organizationOnboardingService.listSubkinds() });
  });

  /** GET /organizations/requirements/:subkind */
  r.get("/requirements/:subkind", zValidator("param", orgRequirementsParamsSchema), (c) => {
    const { subkind } = c.req.valid("param");
    return c.json({
      data: container.organizationOnboardingService.getRequirements(subkind),
    });
  });

  /** GET /organizations/check-name?displayName=... — slug availability with
   * suggestions. Public to avoid round-trips during the wizard.
   */
  r.get("/check-name", zValidator("query", checkOrgNameSchema), async (c) => {
    const { displayName } = c.req.valid("query");
    const result = await container.organizationOnboardingService.checkNameAvailability(displayName);
    return c.json({ data: result });
  });

  /** POST /organizations — create a new organisation. Auth required. */
  r.post("/", requireAuth, zValidator("json", createOrganizationSchema), async (c) => {
    if (!container.orgModuleGate.isEnabled()) {
      const body = container.orgModuleGate.disabledResponse();
      return c.json(body, 403);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const result = await container.organizationOnboardingService.createOrganization(userId, body);
    return c.json({ data: result }, 201);
  });

  r.route("/:entityId/onboarding", createOrganizationOnboardingRoutes(container, authenticator));

  return r;
}
