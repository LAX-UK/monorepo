import {
  legalEntityDocumentUploadSchema,
  orgOnboardingStepKeySchema,
  organizationOnboardingProfileSchema,
} from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerOrganizationOnboardingRoutesSlice } from "../container.js";
import { respondIdentityHttpJson } from "../lib/identity-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const entityIdParamSchema = z.object({
  entityId: z.string().uuid(),
});

const stepParamSchema = entityIdParamSchema.extend({
  stepKey: orgOnboardingStepKeySchema,
});

export function createOrganizationOnboardingRoutes(
  container: ContainerOrganizationOnboardingRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const onboardingHttp = container.identityRoutes.organizationOnboardingHttp;
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.use("*", requireAuth);

  r.use("*", async (c, next) => {
    if (c.req.method === "GET") {
      await next();
      return;
    }
    if (!container.orgModuleGate.isEnabled()) {
      return c.json(container.orgModuleGate.disabledResponse(), 403);
    }
    await next();
  });

  r.get("/", zValidator("param", entityIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { entityId } = c.req.valid("param");
    const response = await onboardingHttp.getOnboarding({ userId, entityId });
    return respondIdentityHttpJson(c, response);
  });

  r.patch(
    "/profile",
    zValidator("param", entityIdParamSchema),
    zValidator("json", organizationOnboardingProfileSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { entityId } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await onboardingHttp.updateProfile({
        userId,
        entityId,
        body: body as Record<string, unknown>,
      });
      return respondIdentityHttpJson(c, response);
    },
  );

  r.post(
    "/documents",
    zValidator("param", entityIdParamSchema),
    zValidator("json", legalEntityDocumentUploadSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { entityId } = c.req.valid("param");
      const body = c.req.valid("json");
      const response = await onboardingHttp.attachDocument({ userId, entityId, body });
      return respondIdentityHttpJson(c, response);
    },
  );

  r.delete(
    "/documents/:documentId",
    zValidator("param", entityIdParamSchema.extend({ documentId: z.string().uuid() })),
    async (c) => {
      const userId = c.get("userId") as string;
      const { entityId, documentId } = c.req.valid("param");
      const response = await onboardingHttp.detachDocument({ userId, entityId, documentId });
      return respondIdentityHttpJson(c, response);
    },
  );

  r.post("/steps/:stepKey/complete", zValidator("param", stepParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { entityId, stepKey } = c.req.valid("param");
    const response = await onboardingHttp.completeStep({ userId, entityId, stepKey });
    return respondIdentityHttpJson(c, response);
  });

  r.post("/submit-for-review", zValidator("param", entityIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { entityId } = c.req.valid("param");
    const response = await onboardingHttp.submitForReview({ userId, entityId });
    return respondIdentityHttpJson(c, response);
  });

  return r;
}
