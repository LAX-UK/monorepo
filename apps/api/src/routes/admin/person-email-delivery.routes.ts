import {
  EMAIL_ADMIN_ACCESS,
  EMAIL_BLOCK_LIFT_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import { adminLiftEmailBlockBodySchema } from "@auction/validators";
import type { Context } from "hono";
import { liftOutcomeResponse } from "../../lib/email-block-lift-response.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireEmailBlockLift,
  requireEmailDeliveryRead,
} from "../../middleware/require-capability.js";
import type { AdminEmailRoutesContainer } from "../../services/interfaces/admin-routes/index.js";
import { adminUserIdParamSchema } from "./_schemas.js";
import type { AdminHono } from "./_shared.js";

function liftActorOf(c: Context) {
  const role = c.get("userRole") as UserRole;
  const staff = c.get("userStaffRoles") as StaffRoles | undefined;
  return {
    userId: c.get("userId") as string,
    canLift: userHasAccessTo(role, staff, EMAIL_BLOCK_LIFT_ACCESS),
    isEmailAdmin: userHasAccessTo(role, staff, EMAIL_ADMIN_ACCESS),
  };
}

/** A person's email delivery for client services and administrators. */
export function attachAdminPersonEmailDeliveryRoutes(
  platform: AdminHono,
  container: AdminEmailRoutesContainer,
): void {
  /** GET /admin/users/:userId/email-delivery — sends, the block and whether the viewer may lift it. */
  platform.get(
    "/users/:userId/email-delivery",
    requireEmailDeliveryRead,
    zValidator("param", adminUserIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const data = await container.admin.emailDelivery.get(userId, liftActorOf(c));
      if (!data) return c.json({ error: "email_address_not_found" }, 404);
      return c.json({ data });
    },
  );

  /** POST /admin/users/:userId/email-delivery/lift — lift the block on the person's address. */
  platform.post(
    "/users/:userId/email-delivery/lift",
    requireEmailBlockLift,
    zValidator("param", adminUserIdParamSchema),
    zValidator("json", adminLiftEmailBlockBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const body = c.req.valid("json");
      const emailHash = await container.admin.emailDelivery.addressHash(userId);
      if (!emailHash) return c.json({ error: "email_address_not_found" }, 404);
      const outcome = await container.admin.emailBlockLift.lift({
        emailHash,
        userId,
        actor: liftActorOf(c),
        reason: body.reason,
        note: body.note,
        writtenRequest: body.writtenRequest,
        expectedSince: new Date(body.expectedSince),
      });
      return liftOutcomeResponse(c, outcome);
    },
  );
}
