import {
  createConditionReportRequestBodySchema,
  lotIdParamSchema,
  scheduleAbsenteeBidBodySchema,
  setAutoBidBodySchema,
} from "@auction/validators";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireBuyerRole } from "../../middleware/require-buyer-role.js";
import type { LotHono, LotRouteDeps } from "./_shared.js";

export function attachLotBiddingRoutes(r: LotHono, deps: LotRouteDeps): void {
  const {
    container,
    requireAuth,
    kycGate,
    biddingKillSwitch,
    bidUserRateLimit,
    requireLegalEntity,
  } = deps;

  r.post(
    "/:id/absentee-bids",
    requireAuth,
    requireBuyerRole,
    kycGate,
    zValidator("param", lotIdParamSchema),
    zValidator("json", scheduleAbsenteeBidBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.absenteeBidService.schedule({
        userId,
        lotId: id,
        buyerLegalEntityId: body.buyerLegalEntityId,
        maxAmount: body.maxAmount,
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value }, 201);
    },
  );

  r.get(
    "/:id/condition-report-request",
    requireAuth,
    requireBuyerRole,
    zValidator("param", lotIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const row = await container.conditionReportService.findForBuyerOnLot({
        userId,
        lotId: id,
      });
      return c.json({ data: row });
    },
  );

  r.post(
    "/:id/condition-report-requests",
    requireAuth,
    requireBuyerRole,
    kycGate,
    zValidator("param", lotIdParamSchema),
    zValidator("json", createConditionReportRequestBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.conditionReportService.createRequest({
        userId,
        lotId: id,
        ...(body.requestNote !== undefined ? { requestNote: body.requestNote } : {}),
        ...(body.requestingLegalEntityId !== undefined
          ? { requestingLegalEntityId: body.requestingLegalEntityId }
          : {}),
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value }, 201);
    },
  );

  r.get(
    "/:id/auto-bid",
    requireAuth,
    requireBuyerRole,
    zValidator("param", lotIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.autoBidService.getAutoBid({
        lotId: id,
        placedByUserId: userId,
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value });
    },
  );

  r.put(
    "/:id/auto-bid",
    requireAuth,
    biddingKillSwitch,
    requireBuyerRole,
    kycGate,
    requireLegalEntity,
    bidUserRateLimit,
    zValidator("param", lotIdParamSchema),
    zValidator("json", setAutoBidBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const legalEntityContext = c.get("legalEntityContext");
      const body = c.req.valid("json");
      const idem = c.req.header("idempotency-key") ?? c.req.header("Idempotency-Key");
      const result = await container.autoBidService.setAutoBid({
        lotId: id,
        placedByUserId: userId,
        buyerLegalEntityId: legalEntityContext?.legalEntityId ?? "",
        maxAutoBidAmount: body.maxAutoBidAmount,
        autoBidStepAmount: body.autoBidStepAmount,
        ...(idem ? { idempotencyKey: idem } : {}),
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value }, 200);
    },
  );

  r.delete(
    "/:id/auto-bid",
    requireAuth,
    biddingKillSwitch,
    requireBuyerRole,
    kycGate,
    bidUserRateLimit,
    zValidator("param", lotIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.autoBidService.clearAutoBid({
        lotId: id,
        placedByUserId: userId,
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value });
    },
  );
}
