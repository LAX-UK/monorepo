import {
  adminBulkUsersBodySchema,
  adminPatchStaffRoleBodySchema,
  adminSetRoleBodySchema,
  adminSuspendBodySchema,
  adminUserIdsLookupQuerySchema,
  adminUserListQuerySchema,
  updateProfileNameFormSchema,
  userIdParamSchema,
} from "@auction/validators";
import { mapAdminUserListQuery } from "../../lib/admin-user-list-query.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireAmlReview,
  requireClientActivity,
  requireClientBids,
  requireClientKyc,
  requireUserInvite,
  requireUserModeration,
  requireUsersDirectory,
} from "../../middleware/require-capability.js";
import type { AdminPeopleUsersRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import { activityQuerySchema, adminUserIdParamSchema, userBidsQuerySchema } from "./_schemas.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminUsersDirectoryRoutes(
  platform: AdminHono,
  container: AdminPeopleUsersRoutesContainer,
): void {
  platform.get(
    "/users",
    requireUsersDirectory,
    zValidator("query", adminUserListQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const page = await container.admin.users.getPage(
        actorRole,
        actorStaff,
        mapAdminUserListQuery(q),
      );
      return c.json({
        data: page.rows,
        meta: {
          total: page.total,
          limit: page.limit,
          offset: page.offset,
          summary: page.summary,
        },
      });
    },
  );

  platform.get(
    "/users/lookup",
    requireUsersDirectory,
    zValidator("query", adminUserIdsLookupQuerySchema),
    async (c) => {
      const { ids } = c.req.valid("query");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.getByIds(actorRole, actorStaff, ids);
      return c.json({ data });
    },
  );

  platform.post(
    "/users/bulk",
    requireUserModeration,
    zValidator("json", adminBulkUsersBodySchema),
    async (c) => {
      const { ids, op, reason } = c.req.valid("json");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.bulkSuspendOrUnsuspend({
        actorRole,
        actorStaffRole: actorStaff,
        ids,
        op,
        reason,
      });
      return c.json({ ok: true, data });
    },
  );

  platform.get(
    "/users/:userId",
    requireUsersDirectory,
    zValidator("param", userIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const row = await container.admin.users.getById(actorRole, actorStaff, userId);
      if (!row) return c.json({ error: "Not found" }, 404);
      return c.json({ data: row });
    },
  );

  platform.get(
    "/users/:userId/kyc-sessions",
    requireClientKyc,
    zValidator("param", userIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.kycSessionsFor(actorRole, actorStaff, userId);
      return c.json({ data });
    },
  );

  platform.get(
    "/users/:userId/aml-screenings",
    requireAmlReview,
    zValidator("param", userIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const data = await container.admin.aml.listForUser(userId);
      return c.json({ data });
    },
  );
}

export function attachAdminUsersManagementRoutes(
  platform: AdminHono,
  container: AdminPeopleUsersRoutesContainer,
): void {
  platform.get(
    "/users/:userId/source-of-funds",
    requireAmlReview,
    zValidator("param", adminUserIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const rows = await container.admin.sourceOfFunds.listForUser(userId, 20);
      return c.json({ data: rows });
    },
  );

  platform.patch(
    requireUsersDirectory,
    zValidator("param", userIdParamSchema),
    zValidator("json", adminSetRoleBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { role, staffRole: targetStaffRole } = c.req.valid("json");
      const actorRole = c.get("userRole") ?? "client";
      const actorId = c.get("userId") as string;
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const setOut = await container.admin.users.setRole(
        actorRole,
        actorId,
        userId,
        role,
        actorStaff,
        targetStaffRole ?? null,
      );
      if (!setOut.ok) {
        return c.json({ error: setOut.message }, asHttpStatus(setOut.status));
      }
      return c.json({ ok: true });
    },
  );

  platform.patch(
    "/users/:userId/staff-role",
    requireUsersDirectory,
    zValidator("param", userIdParamSchema),
    zValidator("json", adminPatchStaffRoleBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { staffRole } = c.req.valid("json");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const setOut = await container.admin.users.setStaffRole(
        actorRole,
        c.get("userId") as string,
        userId,
        staffRole,
        actorStaff,
      );
      if (!setOut.ok) {
        return c.json({ error: setOut.message }, asHttpStatus(setOut.status));
      }
      return c.json({ ok: true });
    },
  );

  platform.post(
    "/users/:userId/suspend",
    requireUserModeration,
    zValidator("param", userIdParamSchema),
    zValidator("json", adminSuspendBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      await container.admin.users.suspend(actorRole, actorStaff, userId, reason ?? null);
      return c.json({ ok: true });
    },
  );

  platform.post(
    "/users/:userId/unsuspend",
    requireUserModeration,
    zValidator("param", userIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      await container.admin.users.unsuspend(actorRole, actorStaff, userId);
      return c.json({ ok: true });
    },
  );

  platform.get(
    "/users/:userId/activity",
    requireClientActivity,
    zValidator("param", userIdParamSchema),
    zValidator("query", activityQuerySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { limit } = c.req.valid("query");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.activityFor(actorRole, actorStaff, userId, limit);
      return c.json({ data });
    },
  );

  platform.get(
    "/users/:userId/bids",
    requireClientBids,
    zValidator("param", userIdParamSchema),
    zValidator("query", userBidsQuerySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { limit, offset } = c.req.valid("query");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.bidsFor(actorRole, actorStaff, userId, {
        limit,
        offset,
      });
      return c.json({ data });
    },
  );

  platform.patch(
    "/users/:userId/profile",
    requireUserInvite,
    zValidator("param", userIdParamSchema),
    zValidator("json", updateProfileNameFormSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const body = c.req.valid("json");
      if (body.name == null) {
        return c.json({ error: "name is required" }, 400);
      }
      await container.admin.users.updateProfileName(userId, body.name);
      return c.json({ ok: true });
    },
  );
}
