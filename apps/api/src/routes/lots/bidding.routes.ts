import {
  createConditionReportRequestBodySchema,
  lotIdParamSchema,
  scheduleAbsenteeBidBodySchema,
  setAutoBidBodySchema,
} from "@auction/validators";
import { respondBiddingRouteOutcome } from "../../lib/bidding-route-response.js";
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

  const { autoBidHttp, absenteeBidHttp, conditionReportHttp } = container.bidding;

  r.post(
    "/:id/absentee-bids",
    requireAuth,
    biddingKillSwitch,
    requireBuyerRole,
    kycGate,
    requireLegalEntity,
    bidUserRateLimit,
    zValidator("param", lotIdParamSchema),
    zValidator("json", scheduleAbsenteeBidBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const legalEntityContext = c.get("legalEntityContext");
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await absenteeBidHttp.scheduleAbsentee({
        userId,
        lotId: id,
        ...(legalEntityContext?.legalEntityId !== undefined
          ? { actingLegalEntityId: legalEntityContext.legalEntityId }
          : {}),
        bodyLegalEntityId: body.buyerLegalEntityId,
        maxAmount: body.maxAmount,
      });
      return respondBiddingRouteOutcome(c, outcome, 201);
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
      const outcome = await conditionReportHttp.findForBuyerOnLot({ userId, lotId: id });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/:id/condition-report-requests",
    requireAuth,
    requireBuyerRole,
    kycGate,
    requireLegalEntity,
    zValidator("param", lotIdParamSchema),
    zValidator("json", createConditionReportRequestBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const legalEntityContext = c.get("legalEntityContext");
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await conditionReportHttp.createRequest({
        userId,
        lotId: id,
        ...(body.requestNote !== undefined ? { requestNote: body.requestNote } : {}),
        ...(legalEntityContext?.legalEntityId !== undefined
          ? { actingLegalEntityId: legalEntityContext.legalEntityId }
          : {}),
        ...(body.requestingLegalEntityId !== undefined
          ? { requestingLegalEntityId: body.requestingLegalEntityId }
          : {}),
      });
      return respondBiddingRouteOutcome(c, outcome, 201);
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
      const outcome = await autoBidHttp.getAutoBid({ lotId: id, placedByUserId: userId });
      return respondBiddingRouteOutcome(c, outcome);
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
      const outcome = await autoBidHttp.setAutoBid({
        lotId: id,
        placedByUserId: userId,
        ...(legalEntityContext?.legalEntityId !== undefined
          ? { actingLegalEntityId: legalEntityContext.legalEntityId }
          : {}),
        maxAutoBidAmount: body.maxAutoBidAmount,
        autoBidStepAmount: body.autoBidStepAmount,
        ...(idem ? { idempotencyKey: idem } : {}),
      });
      return respondBiddingRouteOutcome(c, outcome, 200);
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
      const outcome = await autoBidHttp.clearAutoBid({ lotId: id, placedByUserId: userId });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );
}
