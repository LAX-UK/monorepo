import {
  legalEntityDocumentUploadSchema,
  orgOnboardingStepKeySchema,
  organizationOnboardingProfileSchema,
} from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { isOrgModuleEnabled, orgModuleDisabledResponse } from "../lib/org-module-enabled.js";
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
  container: Container,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.use("*", requireAuth);

  r.use("*", async (c, next) => {
    if (c.req.method === "GET") {
      await next();
      return;
    }
    if (!isOrgModuleEnabled(container.env.WEB_ORIGIN)) {
      return c.json(orgModuleDisabledResponse(), 403);
    }
    await next();
  });

  r.get("/", zValidator("param", entityIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { entityId } = c.req.valid("param");
    const data = await container.organizationOnboardingFlowService.getOnboarding(userId, entityId);
    if (!data) return c.json({ error: "not_found" }, 404);
    return c.json({ data });
  });

  r.patch(
    "/profile",
    zValidator("param", entityIdParamSchema),
    zValidator("json", organizationOnboardingProfileSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { entityId } = c.req.valid("param");
      const body = c.req.valid("json");
      const res = await container.organizationOnboardingFlowService.updateProfile(
        userId,
        entityId,
        {
          displayName: body.displayName,
          legalName: body.legalName ?? null,
          vatNumber: body.vatNumber ?? null,
          primaryAddress: {
            ...body.primaryAddress,
            line2: body.primaryAddress.line2 ?? null,
            state: body.primaryAddress.state ?? null,
            isDefault: body.primaryAddress.isDefault ?? null,
          },
        },
      );
      if (!res.ok) {
        return c.json({ error: res.code }, res.code === "not_found" ? 404 : 403);
      }
      return c.json({ data: { updated: true } });
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
      const res = await container.organizationOnboardingFlowService.attachDocument(
        userId,
        entityId,
        body,
      );
      if (!res.ok) {
        const status =
          res.code === "forbidden"
            ? 403
            : res.code === "upload_not_found"
              ? 404
              : res.code === "duplicate_upload"
                ? 409
                : 400;
        return c.json({ error: res.code }, status);
      }
      return c.json({ data: { id: res.id } }, 201);
    },
  );

  r.delete(
    "/documents/:documentId",
    zValidator("param", entityIdParamSchema.extend({ documentId: z.string().uuid() })),
    async (c) => {
      const userId = c.get("userId") as string;
      const { entityId, documentId } = c.req.valid("param");
      const res = await container.organizationOnboardingFlowService.detachDocument(
        userId,
        entityId,
        documentId,
      );
      if (!res.ok) {
        const status =
          res.code === "forbidden"
            ? 403
            : res.code === "not_found" || res.code === "document_not_found"
              ? 404
              : 409;
        return c.json({ error: res.code }, status);
      }
      return c.body(null, 204);
    },
  );

  r.post("/steps/:stepKey/complete", zValidator("param", stepParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { entityId, stepKey } = c.req.valid("param");
    const res =
      stepKey === "details"
        ? await container.organizationOnboardingFlowService.completeDetailsWithType(
            userId,
            entityId,
          )
        : await container.organizationOnboardingFlowService.completeStep(userId, entityId, stepKey);
    if (!res.ok) {
      const status =
        res.code === "not_found"
          ? 404
          : res.code === "forbidden"
            ? 403
            : res.code === "connect_not_started"
              ? 400
              : 400;
      return c.json({ error: res.code }, status);
    }
    return c.json({ data: { completed: true } });
  });

  r.post("/submit-for-review", zValidator("param", entityIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { entityId } = c.req.valid("param");
    const res = await container.organizationOnboardingFlowService.submitForReview(userId, entityId);
    if (!res.ok) {
      const status =
        res.code === "not_found"
          ? 404
          : res.code === "forbidden"
            ? 403
            : res.code === "user_identity_not_verified"
              ? 403
              : res.code === "onboarding_steps_incomplete"
                ? 400
                : 409;
      const body =
        res.code === "onboarding_steps_incomplete"
          ? { error: res.code, missingSteps: res.missingSteps }
          : { error: res.code };
      return c.json(body, status);
    }
    return c.json({ data: { status: res.status } });
  });

  return r;
}
