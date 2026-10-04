import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { getStaffSessionView } from "../../../application/admin/get-staff-session.js";
import type { ShopFeatureFlagsReader } from "../../../application/ports/shop-feature-flags.js";
import { requireShopAdminSubject } from "../../../plugins/shop-admin-auth.js";

const StaffSessionSchema = Type.Object({
  subject: Type.String(),
  role: Type.String(),
  capabilities: Type.Array(Type.String()),
  features: Type.Object({
    payouts: Type.Boolean(),
    thirdPartySales: Type.Boolean(),
    originalSales: Type.Boolean(),
    merchandise: Type.Boolean(),
  }),
});

export async function registerAdminSessionRoutes(
  app: FastifyInstance,
  deps: { featureFlags: ShopFeatureFlagsReader },
): Promise<void> {
  app.get(
    "/session",
    {
      schema: {
        tags: ["shop-admin"],
        response: {
          200: StaffSessionSchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const subject = requireShopAdminSubject(request);
      const role = request.shopAdminAuth?.role ?? "shop_admin";
      return getStaffSessionView({
        subject,
        role,
        featureFlags: deps.featureFlags,
      });
    },
  );
}
