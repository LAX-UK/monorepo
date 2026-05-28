import { declineLegalEntityInvitationBodySchema } from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
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

function invitationOutcomeStatus(code: string): 400 | 403 | 404 {
  switch (code) {
    case "invitation_not_found":
    case "member_not_found":
      return 404;
    case "invitation_email_mismatch":
      return 403;
    default:
      return 400;
  }
}

export function createLegalEntityRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  /** GET /legal-entities/me — list every active membership for the user. */
  r.get("/me", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    let memberships = await container.legalEntityRepository.listActiveMembershipsForUser(userId);
    if (memberships.length === 0) {
      try {
        await container.personalLegalEntityResolver.resolveForUser(userId);
        memberships = await container.legalEntityRepository.listActiveMembershipsForUser(userId);
      } catch {
        return c.json(
          { error: "personal_entity_unavailable", code: "personal_entity_unavailable", data: [] },
          503,
        );
      }
      if (memberships.length === 0) {
        return c.json(
          { error: "personal_entity_unavailable", code: "personal_entity_unavailable", data: [] },
          503,
        );
      }
    }
    return c.json({ data: memberships });
  });

  /** GET /legal-entities/invitations/mine — pending entity invites for the user's email. */
  r.get("/invitations/mine", requireAuth, async (c) => {
    if (!container.orgModuleGate.isEnabled()) {
      return c.json({ data: [] });
    }
    const userId = c.get("userId") as string;
    const u = await container.userService.getById(userId);
    if (!u) {
      return c.json({ error: "user_not_found" }, 404);
    }
    const data = await container.pendingInvitationsReader.listForEmail(u.email, new Date());
    return c.json({ data });
  });

  /** POST /legal-entities/invitations/:id/accept */
  r.post(
    "/invitations/:id/accept",
    requireAuth,
    zValidator("param", invitationIdParamSchema),
    async (c) => {
      if (!container.orgModuleGate.isEnabled()) {
        const body = container.orgModuleGate.disabledResponse();
        return c.json(body, 403);
      }
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const u = await container.userService.getById(userId);
      if (!u) {
        return c.json({ error: "user_not_found" }, 404);
      }
      const result = await container.invitationLifecycleService.acceptById(userId, u.email, id);
      if (!result.ok) {
        return c.json({ error: result.code }, invitationOutcomeStatus(result.code));
      }
      if (result.kind !== "accepted") {
        return c.json({ error: "unexpected_invitation_outcome" }, 500);
      }
      return c.json({ data: { legalEntityId: result.legalEntityId, member: result.member } }, 201);
    },
  );

  /** POST /legal-entities/invitations/:id/decline */
  r.post(
    "/invitations/:id/decline",
    requireAuth,
    zValidator("param", invitationIdParamSchema),
    zValidator("json", declineLegalEntityInvitationBodySchema),
    async (c) => {
      if (!container.orgModuleGate.isEnabled()) {
        const body = container.orgModuleGate.disabledResponse();
        return c.json(body, 403);
      }
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const u = await container.userService.getById(userId);
      if (!u) {
        return c.json({ error: "user_not_found" }, 404);
      }
      const result = await container.invitationLifecycleService.decline(
        userId,
        u.email,
        id,
        body.reason ?? null,
      );
      if (!result.ok) {
        const status =
          result.code === "invitation_not_found"
            ? 404
            : result.code === "invitation_email_mismatch"
              ? 403
              : 400;
        return c.json({ error: result.code }, status);
      }
      return c.json({ data: { declined: true } });
    },
  );

  /** GET /legal-entities/:id — full legal entity row.
   * Caller must be an active member; non-members get 403 (not 404, to avoid
   * leaking existence).
   */
  r.get("/:id", requireAuth, zValidator("param", legalEntityIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const userRole = c.get("userRole");
    const userStaffRole = c.get("userStaffRole");
    const { id } = c.req.valid("param");
    const result = await container.legalEntityAccessService.getLegalEntityDetailForUser({
      userId,
      userRole,
      userStaffRole,
      legalEntityId: id,
      actingLegalEntityCookie: parseActingLegalEntityCookieFromHeader(c.req.header("Cookie")),
    });
    return c.json(result.body, result.status);
  });

  return r;
}

/** Mounted under /users to keep the user-preference endpoint colocated with
 * other `/users/me/*` endpoints.
 */
export function createActingContextUserRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  /** POST /users/me/acting-context-tooltip — mark first-time tooltip dismissed. */
  r.post("/me/acting-context-tooltip", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    await container.userService.markActingContextTooltipSeen(userId);
    return c.json({ data: { dismissed: true } });
  });

  return r;
}
