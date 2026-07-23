import { declineLegalEntityInvitationBodySchema } from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerLegalEntityRoutesSlice } from "../container.js";
import {
  respondIdentityRawJson,
  respondIdentityRouteOutcome,
} from "../lib/identity-route-response.js";
import { parseActingLegalEntityCookieFromHeader } from "../lib/impersonation-cookie.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const legalEntityIdParamSchema = z.object({
  id: z.string().uuid(),
});

const invitationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export function createLegalEntityRoutes(
  container: ContainerLegalEntityRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const legalEntityHttp = container.identityRoutes.legalEntityHttp;
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.get("/me", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const outcome = await legalEntityHttp.listMyMemberships({ userId });
    if (outcome.kind === "err" && outcome.error.code === "personal_entity_unavailable") {
      return c.json(
        { error: "personal_entity_unavailable", code: "personal_entity_unavailable", data: [] },
        503,
      );
    }
    return respondIdentityRouteOutcome(c, outcome);
  });

  r.get("/invitations/mine", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const outcome = await legalEntityHttp.listPendingInvitations({ userId });
    if (outcome.kind === "err" && outcome.error.code === "user_not_found") {
      return c.json({ error: "user_not_found" }, 404);
    }
    return respondIdentityRouteOutcome(c, outcome);
  });

  r.post(
    "/invitations/:id/accept",
    requireAuth,
    zValidator("param", invitationIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const outcome = await legalEntityHttp.acceptInvitationById({ userId, invitationId: id });
      if (outcome.kind === "err" && outcome.error.message === "user_not_found") {
        return c.json({ error: "user_not_found" }, 404);
      }
      return respondIdentityRouteOutcome(c, outcome, 201);
    },
  );

  r.post(
    "/invitations/:id/decline",
    requireAuth,
    zValidator("param", invitationIdParamSchema),
    zValidator("json", declineLegalEntityInvitationBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await legalEntityHttp.declineInvitation({
        userId,
        invitationId: id,
        reason: body.reason ?? null,
      });
      if (outcome.kind === "err" && outcome.error.message === "user_not_found") {
        return c.json({ error: "user_not_found" }, 404);
      }
      return respondIdentityRouteOutcome(c, outcome);
    },
  );

  r.get("/:id", requireAuth, zValidator("param", legalEntityIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const userRole = c.get("userRole");
    const userStaffRole = c.get("userStaffRole");
    const { id } = c.req.valid("param");
    const result = await legalEntityHttp.getLegalEntityDetail({
      userId,
      ...(userRole !== undefined ? { userRole } : {}),
      ...(userStaffRole !== undefined ? { userStaffRole } : {}),
      legalEntityId: id,
      actingLegalEntityCookie: parseActingLegalEntityCookieFromHeader(c.req.header("Cookie")),
    });
    return respondIdentityRawJson(c, result.body, result.status);
  });

  return r;
}

export function createActingContextUserRoutes(
  container: ContainerLegalEntityRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.post("/me/acting-context-tooltip", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const outcome = await container.identityRoutes.legalEntityHttp.markActingContextTooltipSeen({
      userId,
    });
    return respondIdentityRouteOutcome(c, outcome);
  });

  return r;
}
