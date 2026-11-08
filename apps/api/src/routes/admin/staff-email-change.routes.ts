import {
  adminStaffEmailChangeBodySchema,
  adminStaffEmailChangeCancelBodySchema,
} from "@auction/validators";
import { z } from "zod";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireStaffEmailChange } from "../../middleware/require-capability.js";
import type { AdminStaffEmailChangeService } from "../../services/admin/admin-staff-email-change.service.js";
import type { AdminHono, AdminStaffMutationGuards } from "./_shared.js";

const userParamSchema = z.object({ userId: z.string().min(1) });

/** Moving a person's account to a new email address when they have lost the old inbox. */
export function attachAdminStaffEmailChangeRoutes(
  platform: AdminHono,
  staffEmailChange: Pick<AdminStaffEmailChangeService, "change" | "cancel" | "kycRecord">,
  guards: AdminStaffMutationGuards,
): void {
  const actorOf = (c: {
    get(key: "userId"): unknown;
    get(key: "userRole"): unknown;
    get(key: "userStaffRoles"): unknown;
  }) => ({
    userId: c.get("userId") as string,
    role: (c.get("userRole") as string | undefined) ?? "client",
    staffRoles: c.get("userStaffRoles") as never,
  });

  // The verified name and date of birth staff compare with the caller. Never cached.
  platform.get(
    "/users/:userId/email-change/kyc-record",
    requireStaffEmailChange,
    zValidator("param", userParamSchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      const result = await staffEmailChange.kycRecord(actorOf(c), c.req.valid("param").userId);
      return result.match(
        (record) => c.json({ data: record }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  // Withdraws a change that is waiting for its link. It needs the same rule and fresh sign-in
  // as starting one.
  platform.post(
    "/users/:userId/email-change/cancel",
    requireStaffEmailChange,
    guards.requireStepUp,
    zValidator("param", userParamSchema),
    zValidator("json", adminStaffEmailChangeCancelBodySchema),
    async (c) => {
      const result = await staffEmailChange.cancel(
        actorOf(c),
        c.req.valid("param").userId,
        c.req.valid("json"),
      );
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  platform.post(
    "/users/:userId/email-change",
    requireStaffEmailChange,
    guards.requireStepUp,
    zValidator("param", userParamSchema),
    zValidator("json", adminStaffEmailChangeBodySchema),
    async (c) => {
      const result = await staffEmailChange.change(
        actorOf(c),
        c.req.valid("param").userId,
        c.req.valid("json"),
      );
      return result.match(
        (started) => c.json({ ok: true, pendingEmail: started.pendingEmail }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );
}
