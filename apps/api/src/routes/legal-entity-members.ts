import { legalEntityMember, user } from "@auction/db/schema";
import {
  inviteLegalEntityMemberSchema,
  updateLegalEntityMemberRoleSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { isOrgModuleEnabled, orgModuleDisabledResponse } from "../lib/org-module-enabled.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { MemberPermissionError } from "../services/interfaces/member-management.js";

const memberIdParam = z.object({ memberId: z.string().uuid() });
const acceptBodySchema = z.object({ token: z.string().min(10).max(200) });
const transferBodySchema = z.object({
  memberId: z.string().uuid(),
  confirmationPhrase: z.string().min(1).max(500),
});

const ADMIN_ROLES_FOR_TYPED_REMOVE = new Set(["owner", "admin"]);

function permissionErrorStatus(code: string): 400 | 403 | 404 | 409 {
  switch (code) {
    case "not_a_member":
    case "insufficient_role":
    case "only_primary_admin_can_transfer":
    case "cannot_demote_primary_admin":
    case "cannot_remove_primary_admin":
    case "cannot_transfer_to_self":
      return 403;
    case "already_a_member":
      return 409;
    case "member_not_found":
    case "target_member_not_found":
    case "invitation_not_found":
      return 404;
    case "invitation_email_mismatch":
      return 403;
    default:
      return 400;
  }
}

export function createLegalEntityMemberRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      legalEntityContext?: LegalEntityContext;
    };
  }>();

  /** GET /legal-entities/members — list active members for the acting entity. */
  r.get("/members", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const members = await container.memberManagementService.listMembers(ctx.legalEntityId);
    return c.json({ data: members });
  });

  /** POST /legal-entities/members — invite by email (admin / owner only). */
  r.post(
    "/members",
    requireAuth,
    requireContext,
    zValidator("json", inviteLegalEntityMemberSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const body = c.req.valid("json");
      try {
        const result = await container.invitationLifecycleService.invite(
          userId,
          ctx.legalEntityId,
          body,
        );
        return c.json({ data: result }, 201);
      } catch (err) {
        if (err instanceof MemberPermissionError) {
          return c.json({ error: err.code }, permissionErrorStatus(err.code));
        }
        throw err;
      }
    },
  );

  /** PATCH /legal-entities/members/:memberId — change role. */
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
      try {
        const updated = await container.memberManagementService.updateRole(
          userId,
          ctx.legalEntityId,
          memberId,
          body,
        );
        return c.json({ data: updated });
      } catch (err) {
        if (err instanceof MemberPermissionError) {
          return c.json({ error: err.code }, permissionErrorStatus(err.code));
        }
        throw err;
      }
    },
  );

  /** DELETE /legal-entities/members/:memberId — soft remove. */
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

      const [targetRow] = await container.db
        .select({
          role: legalEntityMember.role,
          memberName: user.name,
        })
        .from(legalEntityMember)
        .innerJoin(user, eq(user.id, legalEntityMember.userId))
        .where(
          and(
            eq(legalEntityMember.id, memberId),
            eq(legalEntityMember.legalEntityId, ctx.legalEntityId),
            isNull(legalEntityMember.removedAt),
          ),
        )
        .limit(1);

      if (targetRow && ADMIN_ROLES_FOR_TYPED_REMOVE.has(targetRow.role)) {
        const expected = `REMOVE ${targetRow.memberName}`;
        if (confirmationPhrase !== expected) {
          return c.json(
            {
              error: "confirmation_required",
              message: `Type exactly: ${expected}`,
            },
            400,
          );
        }
      }

      try {
        await container.memberManagementService.removeMember(userId, ctx.legalEntityId, memberId);
        return c.json({ data: { removed: true } });
      } catch (err) {
        if (err instanceof MemberPermissionError) {
          return c.json({ error: err.code }, permissionErrorStatus(err.code));
        }
        throw err;
      }
    },
  );

  /** POST /legal-entities/members/transfer-primary-admin */
  r.post(
    "/members/transfer-primary-admin",
    requireAuth,
    requireContext,
    zValidator("json", transferBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const body = c.req.valid("json");
      const [targetRow] = await container.db
        .select({ memberName: user.name })
        .from(legalEntityMember)
        .innerJoin(user, eq(user.id, legalEntityMember.userId))
        .where(
          and(
            eq(legalEntityMember.id, body.memberId),
            eq(legalEntityMember.legalEntityId, ctx.legalEntityId),
            isNull(legalEntityMember.removedAt),
          ),
        )
        .limit(1);
      const expected = targetRow ? `TRANSFER PRIMARY TO ${targetRow.memberName}` : "";
      if (!targetRow || body.confirmationPhrase !== expected) {
        return c.json(
          {
            error: "confirmation_mismatch",
            message: targetRow ? `Type exactly: ${expected}` : "member_not_found",
          },
          400,
        );
      }
      try {
        const result = await container.memberManagementService.transferPrimaryAdmin(
          userId,
          ctx.legalEntityId,
          body.memberId,
        );
        return c.json({ data: result });
      } catch (err) {
        if (err instanceof MemberPermissionError) {
          return c.json({ error: err.code }, permissionErrorStatus(err.code));
        }
        throw err;
      }
    },
  );

  /** POST /legal-entities/invitations/accept — accept an entity-scoped invite
   * after sign-in / sign-up. Doesn't require X-Legal-Entity-Id (the entity
   * is encoded in the token).
   */
  r.post("/invitations/accept", requireAuth, zValidator("json", acceptBodySchema), async (c) => {
    if (!isOrgModuleEnabled(container.env.WEB_ORIGIN)) {
      const body = orgModuleDisabledResponse();
      return c.json(body, 403);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const u = await container.userService.getById(userId);
    if (!u) {
      return c.json({ error: "user_not_found" }, 404);
    }
    const result = await container.invitationLifecycleService.accept(userId, u.email, body.token);
    if (!result.ok) {
      return c.json({ error: result.code }, permissionErrorStatus(result.code));
    }
    if (result.kind !== "accepted") {
      return c.json({ error: "unexpected_invitation_outcome" }, 500);
    }
    return c.json({ data: { legalEntityId: result.legalEntityId, member: result.member } }, 201);
  });

  return r;
}
