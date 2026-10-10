import { z } from "zod";
import { zValidator } from "../../lib/z-validator.js";
import { requirePlatformAdminFull } from "../../middleware/require-capability.js";
import type { TwoFactorPolicyService } from "../../services/security/two-factor-policy.service.js";
import type { AdminHono } from "./_shared.js";

const twoFactorPolicyBodySchema = z.object({ required: z.boolean() });

export function attachAdminSecurityRoutes(
  platform: AdminHono,
  twoFactorPolicy: Pick<TwoFactorPolicyService, "readStaffPolicy" | "setStaffPolicy">,
): void {
  platform.get("/security/staff-two-factor", requirePlatformAdminFull, async (c) => {
    return c.json({ data: await twoFactorPolicy.readStaffPolicy() });
  });

  platform.put(
    "/security/staff-two-factor",
    requirePlatformAdminFull,
    zValidator("json", twoFactorPolicyBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { required } = c.req.valid("json");
      return c.json({ data: await twoFactorPolicy.setStaffPolicy(userId, required) });
    },
  );
}
