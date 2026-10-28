import {
  adminAssignLaxAdminRoleBodySchema,
  adminAssignStaffRoleBodySchema,
  adminRemoveLaxAdminRoleBodySchema,
  adminRemoveStaffRoleBodySchema,
  userIdParamSchema,
} from "@auction/validators";
import type { Context } from "hono";
import type { Result } from "neverthrow";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireStaffAccessReview,
  requireStaffRolesRead,
  requireUserInvite,
} from "../../middleware/require-capability.js";
import type { LaxAdminRolesService } from "../../services/staff/lax-admin-roles.service.js";
import type {
  StaffRolesAdminService,
  StaffRolesError,
} from "../../services/staff/staff-roles-admin.service.js";
import type { AdminHono, AdminStaffMutationGuards } from "./_shared.js";

function respond<T>(c: Context, result: Result<T, StaffRolesError>) {
  return result.match(
    (data) => c.json({ data: data ?? { ok: true } }),
    (error) =>
      c.json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, error.status),
  );
}

/**
 * Bid staff roles: one person's roles (their staff record), giving and removing a role (role
 * managers, after a recent sign-in), and the access review of everyone's roles.
 */
export function attachAdminStaffRolesRoutes(
  platform: AdminHono,
  staffRoles: Pick<StaffRolesAdminService, "overview" | "assign" | "remove" | "accessReview">,
  guards: AdminStaffMutationGuards,
): void {
  platform.get("/staff/access-review", requireStaffAccessReview, async (c) =>
    c.json({ data: await staffRoles.accessReview() }),
  );

  platform.get(
    "/staff/:userId/roles",
    requireStaffRolesRead,
    zValidator("param", userIdParamSchema),
    async (c) => respond(c, await staffRoles.overview(c.req.valid("param").userId)),
  );

  platform.post(
    "/staff/:userId/roles",
    requireUserInvite,
    guards.requireStepUp,
    zValidator("param", userIdParamSchema),
    zValidator("json", adminAssignStaffRoleBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { role, endsAt, reason } = c.req.valid("json");
      return respond(
        c,
        await staffRoles.assign({
          userId,
          actorUserId: c.get("userId") as string,
          role,
          endsAt: endsAt ? new Date(endsAt) : null,
          reason,
        }),
      );
    },
  );

  platform.post(
    "/staff/:userId/roles/remove",
    requireUserInvite,
    guards.requireStepUp,
    zValidator("param", userIdParamSchema),
    zValidator("json", adminRemoveStaffRoleBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { role, reason } = c.req.valid("json");
      return respond(
        c,
        await staffRoles.remove({ userId, actorUserId: c.get("userId") as string, role, reason }),
      );
    },
  );
}

/**
 * LAX Admin roles on the same staff record: one person's roles and what is waiting for LAX Admin
 * to apply, and giving or removing a role, with the same guards as Bid roles.
 */
export function attachAdminLaxAdminRolesRoutes(
  platform: AdminHono,
  laxAdminRoles: Pick<LaxAdminRolesService, "overview" | "assign" | "remove">,
  guards: AdminStaffMutationGuards,
): void {
  platform.get(
    "/staff/:userId/lax-admin-roles",
    requireStaffRolesRead,
    zValidator("param", userIdParamSchema),
    async (c) => respond(c, await laxAdminRoles.overview(c.req.valid("param").userId)),
  );

  platform.post(
    "/staff/:userId/lax-admin-roles",
    requireUserInvite,
    guards.requireStepUp,
    zValidator("param", userIdParamSchema),
    zValidator("json", adminAssignLaxAdminRoleBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { role, endsAt, reason } = c.req.valid("json");
      return respond(
        c,
        await laxAdminRoles.assign({
          userId,
          actorUserId: c.get("userId") as string,
          role,
          endsAt: endsAt ? new Date(endsAt) : null,
          reason,
        }),
      );
    },
  );

  platform.post(
    "/staff/:userId/lax-admin-roles/remove",
    requireUserInvite,
    guards.requireStepUp,
    zValidator("param", userIdParamSchema),
    zValidator("json", adminRemoveLaxAdminRoleBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { role, reason } = c.req.valid("json");
      return respond(
        c,
        await laxAdminRoles.remove({
          userId,
          actorUserId: c.get("userId") as string,
          role,
          reason,
        }),
      );
    },
  );
}
