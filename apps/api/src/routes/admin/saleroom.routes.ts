import {
  adminPaddleAssignBodySchema,
  adminPaddlePlaceBidBodySchema,
  adminPaddleRegistrationParamsSchema,
  adminSalePaddleRosterParamsSchema,
  adminSaleroomCheckInBodySchema,
  adminSaleroomCheckInCandidatesQuerySchema,
  adminSaleroomSaleIdParamSchema,
  adminTelephonePlaceBidBodySchema,
} from "@auction/validators";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireAuctionManage } from "../../middleware/require-capability.js";
import type { AdminOperationsSaleroomRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminSaleroomRoutes(
  platform: AdminHono,
  container: AdminOperationsSaleroomRoutesContainer,
): void {
  platform.get(
    "/sales/:saleId/expected-guests",
    requireAuctionManage,
    zValidator("param", z.object({ saleId: z.string().uuid() })),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const data = await container.admin.saleroomCheckIn.listExpectedGuests(saleId);
      return c.json({ data });
    },
  );

  platform.get(
    "/sales/:saleId/registrations/check-in-candidates",
    requireAuctionManage,
    zValidator("param", z.object({ saleId: z.string().uuid() })),
    zValidator("query", adminSaleroomCheckInCandidatesQuerySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const { q } = c.req.valid("query");
      const items = await container.admin.saleroomCheckIn.searchCandidates({ saleId, q });
      return c.json({ data: { items } });
    },
  );

  platform.post(
    "/sales/:saleId/registrations/check-in",
    requireAuctionManage,
    zValidator("param", z.object({ saleId: z.string().uuid() })),
    zValidator("json", adminSaleroomCheckInBodySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const body = c.req.valid("json");
      const clerkUserId = c.get("userId") as string;
      const result = await container.admin.saleroomCheckIn.checkInBidder({
        saleId,
        userId: body.userId,
        buyerLegalEntityId: body.buyerLegalEntityId,
        decidedByUserId: clerkUserId,
        assignPaddle: body.assignPaddle,
        ...(body.bidLimit != null ? { bidLimit: body.bidLimit } : {}),
        ...(body.paddleNumber != null ? { paddleNumber: body.paddleNumber } : {}),
        ...(body.laxNotes != null ? { laxNotes: body.laxNotes } : {}),
      });
      return result.match(
        (data) =>
          c.json({
            data: {
              registrationId: data.registrationId,
              paddleNumber: data.paddleNumber,
              checkedInAt: data.checkedInAt.toISOString(),
              ...(data.bidLimit != null ? { bidLimit: data.bidLimit } : {}),
            },
          }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/saleroom/telephone-bids",
    requireAuctionManage,
    zValidator("json", adminTelephonePlaceBidBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      const clerkUserId = c.get("userId") as string;
      const idempotencyKey =
        body.idempotencyKey ??
        c.req.header("idempotency-key") ??
        c.req.header("Idempotency-Key") ??
        (body.telephoneBookingId
          ? `telephone-booking:${body.lotId}:${body.telephoneBookingId}:${body.amount}`
          : `telephone-clerk:${body.lotId}:${clerkUserId}:${body.buyerUserId}:${body.amount}`);
      const out = await container.admin.liveBidding.placeTelephoneBid({
        lotId: body.lotId,
        buyerUserId: body.buyerUserId,
        buyerLegalEntityId: body.buyerLegalEntityId,
        amount: body.amount,
        clerkUserId,
        ...(body.maxAutoBidAmount !== undefined ? { maxAutoBidAmount: body.maxAutoBidAmount } : {}),
        ...(body.telephoneBookingId != null ? { telephoneBookingId: body.telephoneBookingId } : {}),
        idempotencyKey,
      });
      if (out.type === "replay") {
        return c.json(out.body, 201);
      }
      if (out.type === "err") {
        const e = out.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json(out.body, 201);
    },
  );

  platform.post(
    "/saleroom/paddle-bids",
    requireAuctionManage,
    zValidator("json", adminPaddlePlaceBidBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      const clerkUserId = c.get("userId") as string;
      const idempotencyKey =
        body.idempotencyKey ??
        c.req.header("idempotency-key") ??
        c.req.header("Idempotency-Key") ??
        `paddle:${body.saleId}:${body.paddleNumber}:${body.lotId}:${body.amount}`;
      const out = await container.admin.liveBidding.placeClerkPaddleBid({
        saleId: body.saleId,
        lotId: body.lotId,
        paddleNumber: body.paddleNumber,
        amount: body.amount,
        clerkUserId,
        ...(body.maxAutoBidAmount !== undefined ? { maxAutoBidAmount: body.maxAutoBidAmount } : {}),
        idempotencyKey,
      });
      return c.json(out.body, out.httpStatus as ContentfulStatusCode);
    },
  );

  platform.post(
    "/sales/:saleId/registrations/:registrationId/paddle",
    requireAuctionManage,
    zValidator("param", adminPaddleRegistrationParamsSchema),
    zValidator("json", adminPaddleAssignBodySchema),
    async (c) => {
      const { saleId, registrationId } = c.req.valid("param");
      const body = c.req.valid("json");
      const clerkUserId = c.get("userId") as string;
      const result = await container.admin.liveBidding.assignPaddle({
        saleId,
        registrationId,
        clerkUserId,
        ...(body.paddleNumber != null ? { paddleNumber: body.paddleNumber } : {}),
      });
      return result.match(
        (data) => c.json({ data }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.delete(
    "/sales/:saleId/registrations/:registrationId/paddle",
    requireAuctionManage,
    zValidator("param", adminPaddleRegistrationParamsSchema),
    async (c) => {
      const { saleId, registrationId } = c.req.valid("param");
      const clerkUserId = c.get("userId") as string;
      const result = await container.admin.liveBidding.clearPaddle({
        saleId,
        registrationId,
        clerkUserId,
      });
      return result.match(
        () => c.json({ ok: true }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.get(
    "/sales/:saleId/paddles",
    requireAuctionManage,
    zValidator("param", adminSalePaddleRosterParamsSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const roster = await container.admin.liveBidding.listSaleRoster(saleId);
      return c.json({ data: { items: roster } });
    },
  );

  platform.get(
    "/sales/:saleId/operations-snapshot",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const data = await container.admin.saleroom.getOperationsSnapshot(saleId);
      if (!data) return c.json({ error: "Sale not found or not a saleroom sale" }, 404);
      return c.json({ data });
    },
  );
}
