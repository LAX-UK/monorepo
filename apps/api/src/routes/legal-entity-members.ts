import { MEMBER_CHANGE_DENIAL_MESSAGE } from "@auction/domain";
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
import { requireEntityCapability } from "../middleware/require-entity-capability.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { TwoFactorPolicyForbiddenError } from "../services/security/two-factor-policy.service.js";

const memberIdParam = z.object({ memberId: z.string().uuid() });
const invitationIdParam = z.object({ invitationId: z.string().uuid() });
const twoFactorPolicyBodySchema = z.object({ required: z.boolean() });
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
  // Names, emails and roles are for the people who run the team; each change is then decided
  // by the member change policy in the service.
  const requireReadMembers = requireEntityCapability(
    "entity.members.read",
    "Only owners and admins can see the member list.",
  );
  const requireManageMembers = requireEntityCapability(
    "entity.members.manage",
    MEMBER_CHANGE_DENIAL_MESSAGE.cannot_manage_members,
  );
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      legalEntityContext?: LegalEntityContext;
    };
  }>();

  r.get("/members", requireAuth, requireContext, requireReadMembers, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const outcome = await memberHttp.listMembers({ legalEntityId: ctx.legalEntityId });
    return respondIdentityRouteOutcome(c, outcome);
  });

  /**
   * The owners by name, for any member: a page a member's role can't open says whom to ask
   * ("Need access? Ask an owner: Maya Okafor"). Names only; emails stay with the member list.
   */
  r.get("/members/owners", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const outcome = await memberHttp.listOwnerContacts({ legalEntityId: ctx.legalEntityId });
    return respondIdentityRouteOutcome(c, outcome);
  });

  r.post(
    "/members",
    requireAuth,
    requireContext,
    requireManageMembers,
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
    requireManageMembers,
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
    requireManageMembers,
    zValidator("param", memberIdParam),
    async (c) => {
      const userId = c.get("userId") as string;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const { memberId } = c.req.valid("param");
      const outcome = await memberHttp.removeMember({
        userId,
        legalEntityId: ctx.legalEntityId,
        memberId,
      });
      if (outcome.kind === "err") {
        return respondIdentityError(c, outcome.error);
      }
      return respondIdentityRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/members/transfer-ownership",
    requireAuth,
    requireContext,
    requireManageMembers,
    zValidator("json", transferBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const body = c.req.valid("json");
      const outcome = await memberHttp.transferOwnership({
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

  /** Any member leaves the acting organisation; the last owner is refused with a reason key. */
  r.post("/members/leave", requireAuth, requireContext, async (c) => {
    const userId = c.get("userId") as string;
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const outcome = await memberHttp.leave({ userId, legalEntityId: ctx.legalEntityId });
    if (outcome.kind === "err") {
      return respondIdentityError(c, outcome.error);
    }
    return respondIdentityRouteOutcome(c, outcome);
  });

  r.get("/invitations", requireAuth, requireContext, requireReadMembers, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const outcome = await memberHttp.listInvitations({ legalEntityId: ctx.legalEntityId });
    return respondIdentityRouteOutcome(c, outcome);
  });

  r.delete(
    "/invitations/:invitationId",
    requireAuth,
    requireContext,
    requireManageMembers,
    zValidator("param", invitationIdParam),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const outcome = await memberHttp.withdrawInvitation({
        userId: c.get("userId") as string,
        legalEntityId: ctx.legalEntityId,
        invitationId: c.req.valid("param").invitationId,
      });
      return respondIdentityRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/invitations/:invitationId/restore",
    requireAuth,
    requireContext,
    requireManageMembers,
    zValidator("param", invitationIdParam),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const outcome = await memberHttp.restoreInvitation({
        userId: c.get("userId") as string,
        legalEntityId: ctx.legalEntityId,
        invitationId: c.req.valid("param").invitationId,
      });
      return respondIdentityRouteOutcome(c, outcome);
    },
  );

  r.get("/two-factor-policy", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    try {
      return c.json({ data: await container.identityRoutes.orgTwoFactorPolicy.readOrgPolicy(ctx) });
    } catch (error) {
      if (error instanceof TwoFactorPolicyForbiddenError)
        return c.json({ error: "forbidden" }, 403);
      throw error;
    }
  });

  r.put(
    "/two-factor-policy",
    requireAuth,
    requireContext,
    zValidator("json", twoFactorPolicyBodySchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const { required } = c.req.valid("json");
      try {
        return c.json({
          data: await container.identityRoutes.orgTwoFactorPolicy.setOrgPolicy(ctx, required),
        });
      } catch (error) {
        if (error instanceof TwoFactorPolicyForbiddenError) {
          return c.json({ error: "forbidden" }, 403);
        }
        throw error;
      }
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
