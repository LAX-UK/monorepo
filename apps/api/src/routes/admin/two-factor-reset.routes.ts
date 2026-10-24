import { z } from "zod";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireUserModeration } from "../../middleware/require-capability.js";
import type { AdminTwoFactorResetService } from "../../services/admin/admin-two-factor-reset.service.js";
import type { AdminHono } from "./_shared.js";

const userParamSchema = z.object({ userId: z.string().min(1) });
/** A reason is required so the audit entry says why someone's sign-in protection was removed. */
const resetBodySchema = z.object({ reason: z.string().trim().min(10).max(500) });

/** Resetting two-step verification for a customer who lost every way to pass it. */
export function attachAdminTwoFactorResetRoutes(
  platform: AdminHono,
  twoFactorReset: Pick<AdminTwoFactorResetService, "reset">,
): void {
  platform.post(
    "/users/:userId/two-factor/reset",
    requireUserModeration,
    zValidator("param", userParamSchema),
    zValidator("json", resetBodySchema),
    async (c) => {
      const result = await twoFactorReset.reset(
        {
          userId: c.get("userId") as string,
          role: (c.get("userRole") as string | undefined) ?? "client",
          staffRole: c.get("userStaffRole") as string | null | undefined,
        },
        c.req.valid("param").userId,
        c.req.valid("json").reason,
      );
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );
}
