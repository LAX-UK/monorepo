import {
  adminRejectSaleRegistrationBodySchema,
  adminSaleRegistrationListQuerySchema,
  adminSaleRegistrationParamsSchema,
  adminUpdateSaleRegistrationBidLimitBodySchema,
} from "@auction/validators";
import { z } from "zod";
import type { ContainerAdminRoutesSlice } from "../../container.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireAuctionManage } from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminSaleRegistrationsRoutes(
  platform: AdminHono,
  container: ContainerAdminRoutesSlice,
): void {
  platform.get(
    "/sales/:saleId/registrations",
    requireAuctionManage,
    zValidator("param", z.object({ saleId: z.string().uuid() })),
    zValidator("query", adminSaleRegistrationListQuerySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const query = c.req.valid("query");
      const items = await container.admin.saleRegistrations.listForSaleAdmin({
        saleId,
        status: query.status,
      });
      return c.json({ data: { items } });
    },
  );

  platform.post(
    "/sales/:saleId/registrations/:registrationId/approve",
    requireAuctionManage,
    zValidator("param", adminSaleRegistrationParamsSchema),
    async (c) => {
      const { saleId, registrationId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.saleRegistrations.approve({
        saleId,
        registrationId,
        decidedByUserId: userId,
      });
      return result.match(
        () => c.json({ ok: true }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/registrations/:registrationId/reject",
    requireAuctionManage,
    zValidator("param", adminSaleRegistrationParamsSchema),
    zValidator("json", adminRejectSaleRegistrationBodySchema),
    async (c) => {
      const { saleId, registrationId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.saleRegistrations.reject({
        saleId,
        registrationId,
        decidedByUserId: userId,
        ...(reason !== undefined ? { reason } : {}),
      });
      return result.match(
        () => c.json({ ok: true }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.patch(
    "/sales/:saleId/registrations/:registrationId/bid-limit",
    requireAuctionManage,
    zValidator("param", adminSaleRegistrationParamsSchema),
    zValidator("json", adminUpdateSaleRegistrationBidLimitBodySchema),
    async (c) => {
      const { saleId, registrationId } = c.req.valid("param");
      const { bidLimit } = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.saleRegistrations.updateBidLimit({
        saleId,
        registrationId,
        bidLimit,
        decidedByUserId: userId,
      });
      return result.match(
        () => c.json({ ok: true }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );
}
