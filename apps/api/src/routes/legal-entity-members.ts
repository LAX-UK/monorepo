import {
  inviteLegalEntityMemberSchema,
  updateLegalEntityMemberRoleSchema,
} from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerLegalEntityMemberRoutesSlice } from "../container.js";
import {
  respondIdentityError,
  respondIdentityRouteOutcome,
} from "../lib/identity-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const memberIdParam = z.object({ memberId: z.string().uuid() });
const acceptBodySchema = z.object({ token: z.string().min(10).max(200) });
const transferBodySchema = z.object({
  memberId: z.string().uuid(),
  confirmationPhrase: z.string().min(1).max(500),
});

export function createLegalEntityMemberRoutes(
  container: ContainerLegalEntityMemberRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const memberHttp = container.identityRoutes.legalEntityMemberHttp;
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      legalEntityContext?: LegalEntityContext;
    };
  }>();

  r.get("/members", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const outcome = await memberHttp.listMembers({ legalEntityId: ctx.legalEntityId });
    return respondIdentityRouteOutcome(c, outcome);
  });

  r.post(
    "/members",
    requireAuth,
    requireContext,
    zValidator("json", inviteLegalEntityMemberSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const body = c.req.valid("json");
      const outcome = await memberHttp.inviteMember({
        userId,
        legalEntityId: ctx.legalEntityId,
        body,
      });
      return respondIdentityRouteOutcome(c, outcome, 201);
    },
  );

  r.patch(
    "/members/:memberId",
    requireAuth,
    requireContext,
    zValidator("param", memberIdParam),
    zValidator("json", updateLegalEntityMemberRoleSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const { memberId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await memberHttp.updateMemberRole({
        userId,
        legalEntityId: ctx.legalEntityId,
        memberId,
        body,
      });
      return respondIdentityRouteOutcome(c, outcome);
    },
  );

  r.delete(
    "/members/:memberId",
    requireAuth,
    requireContext,
    zValidator("param", memberIdParam),
    async (c) => {
      const userId = c.get("userId") as string;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const { memberId } = c.req.valid("param");
      let confirmationPhrase: string | undefined;
      const ct = c.req.header("content-type") ?? "";
      if (ct.includes("application/json")) {
        try {
          const raw = await c.req.json();
          confirmationPhrase =
            typeof raw === "object" && raw && "confirmationPhrase" in raw
              ? String((raw as { confirmationPhrase?: unknown }).confirmationPhrase ?? "")
              : undefined;
        } catch {
          // ignore invalid JSON
        }
      }
      const outcome = await memberHttp.removeMember({
        userId,
        legalEntityId: ctx.legalEntityId,
        memberId,
        ...(confirmationPhrase !== undefined ? { confirmationPhrase } : {}),
      });
      if (outcome.kind === "err") {
        return respondIdentityError(c, outcome.error);
      }
      return respondIdentityRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/members/transfer-primary-admin",
    requireAuth,
    requireContext,
    zValidator("json", transferBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const body = c.req.valid("json");
      const outcome = await memberHttp.transferPrimaryAdmin({
        userId,
        legalEntityId: ctx.legalEntityId,
        memberId: body.memberId,
        confirmationPhrase: body.confirmationPhrase,
      });
      if (outcome.kind === "err") {
        return respondIdentityError(c, outcome.error);
      }
      return respondIdentityRouteOutcome(c, outcome);
    },
  );

  r.post("/invitations/accept", requireAuth, zValidator("json", acceptBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const outcome = await memberHttp.acceptInvitationByToken({ userId, token: body.token });
    if (outcome.kind === "err" && outcome.error.message === "user_not_found") {
      return c.json({ error: "user_not_found" }, 404);
    }
    return respondIdentityRouteOutcome(c, outcome, 201);
  });

  return r;
}
