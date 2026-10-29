import type { StaffRoles } from "@auction/types";
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

const rememberAccountBodySchema = z.object({
  legalEntityId: z.string().uuid(),
});

const recordAccountParamSchema = z.object({
  kind: z.enum(["consignment", "purchase"]),
  id: z.string().uuid(),
});

/** The raw token from an invitation email; the same bounds as accepting it. */
const invitationTokenBodySchema = z.object({ token: z.string().min(10).max(200) });

/** Ten seconds, private: the web app keeps the same answer as long, per session. */
const MEMBERSHIPS_CACHE_CONTROL = "private, max-age=10";

const restoreAccountBodySchema = z.object({
  /** The account this browser last used; `null` on a new device. */
  candidateId: z.string().uuid().nullable(),
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
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();

  /**
   * Every account the person may use. Read on every signed-in page, so it is a cheap private
   * read: it may be kept briefly per session (never by a shared cache), and the rate limiter
   * gives it a per-session budget (see `rate-limit.ts`).
   */
  r.get("/me", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const outcome = await legalEntityHttp.listMyMemberships({ userId });
    if (outcome.kind === "err" && outcome.error.code === "personal_entity_unavailable") {
      c.header("Cache-Control", "no-store");
      return c.json(
        { error: "personal_entity_unavailable", code: "personal_entity_unavailable", data: [] },
        503,
      );
    }
    if (outcome.kind === "ok") {
      c.header("Cache-Control", MEMBERSHIPS_CACHE_CONTROL);
      c.header("Vary", "Authorization, Cookie");
    }
    return respondIdentityRouteOutcome(c, outcome);
  });

  /** What an invitation link is, for the signed-in person who opened it. Changes nothing. */
  r.post(
    "/invitations/preview",
    requireAuth,
    zValidator("json", invitationTokenBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { token } = c.req.valid("json");
      const outcome = await legalEntityHttp.previewInvitationByToken({ userId, token });
      c.header("Cache-Control", "no-store");
      return respondIdentityRouteOutcome(c, outcome);
    },
  );

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

  /** Remember the account the person now uses Bid as, so every device opens in it. */
  r.put(
    "/me/remembered-account",
    requireAuth,
    zValidator("json", rememberAccountBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { legalEntityId } = c.req.valid("json");
      const outcome = await container.identityRoutes.rememberedAccount.remember(
        userId,
        legalEntityId,
      );
      if (!outcome.ok) return c.json({ error: outcome.reason, code: outcome.reason }, 403);
      return c.json({ data: { legalEntityId } });
    },
  );

  /**
   * The account Bid should open in: this browser's, else the remembered one, while the person
   * may still use it; otherwise their personal account, naming the organisation they lost.
   */
  r.post(
    "/me/remembered-account/restore",
    requireAuth,
    zValidator("json", restoreAccountBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { candidateId } = c.req.valid("json");
      const restored = await container.identityRoutes.rememberedAccount.restore(
        userId,
        candidateId,
      );
      if (!restored) {
        return c.json(
          { error: "personal_entity_unavailable", code: "personal_entity_unavailable" },
          503,
        );
      }
      return c.json({ data: restored });
    },
  );

  /** Which of the person's accounts a consignment or purchase belongs to. */
  r.get(
    "/me/record-account/:kind/:id",
    requireAuth,
    zValidator("param", recordAccountParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { kind, id } = c.req.valid("param");
      const outcome = await container.identityRoutes.recordAccount.accountFor(userId, kind, id);
      if (outcome.kind === "not_found")
        return c.json({ error: "not_found", code: "not_found" }, 404);
      if (outcome.kind === "no_access") {
        return c.json({ error: "not_a_member", code: "not_a_member" }, 403);
      }
      return c.json({ data: { legalEntityId: outcome.legalEntityId } });
    },
  );

  r.get("/:id", requireAuth, zValidator("param", legalEntityIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const userRole = c.get("userRole");
    const userStaffRoles = c.get("userStaffRoles");
    const { id } = c.req.valid("param");
    const result = await legalEntityHttp.getLegalEntityDetail({
      userId,
      ...(userRole !== undefined ? { userRole } : {}),
      ...(userStaffRoles !== undefined ? { userStaffRoles } : {}),
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
