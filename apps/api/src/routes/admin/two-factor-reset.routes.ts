import { adminResetTwoFactorBodySchema } from "@auction/validators";
import { z } from "zod";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireUserModeration } from "../../middleware/require-capability.js";
import type { AdminTwoFactorResetService } from "../../services/admin/admin-two-factor-reset.service.js";
import type { AdminHono } from "./_shared.js";

const userParamSchema = z.object({ userId: z.string().min(1) });

/** Resetting two-step verification for a customer who lost every way to pass it. */
export function attachAdminTwoFactorResetRoutes(
  platform: AdminHono,
  twoFactorReset: Pick<AdminTwoFactorResetService, "reset">,
): void {
  platform.post(
    "/users/:userId/two-factor/reset",
    requireUserModeration,
    zValidator("param", userParamSchema),
    zValidator("json", adminResetTwoFactorBodySchema),
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
