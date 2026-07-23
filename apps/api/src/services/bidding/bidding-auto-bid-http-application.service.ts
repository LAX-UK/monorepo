import type { Bid } from "@auction/types";
import { resolveActingBuyerLegalEntity } from "../../lib/resolve-acting-buyer-legal-entity.js";
import type { AutoBidService, AutoBidSettings } from "../auto-bid.service.js";
import type { IBiddingAutoBidHttpApplicationService } from "../interfaces/bidding-routes/bidding-auto-bid-http.js";
import {
  type BiddingRouteOutcome,
  biddingRouteFromBidError,
} from "../interfaces/bidding-routes/bidding-route-http.js";

export class BiddingAutoBidHttpApplicationService implements IBiddingAutoBidHttpApplicationService {
  constructor(private readonly autoBidService: AutoBidService) {}

  async getAutoBid(input: {
    lotId: string;
    placedByUserId: string;
  }): Promise<BiddingRouteOutcome<AutoBidSettings | null>> {
    const result = await this.autoBidService.getAutoBid(input);
    if (result.isErr()) return biddingRouteFromBidError(result.error);
    return { kind: "ok", data: result.value };
  }

  async setAutoBid(input: {
    lotId: string;
    placedByUserId: string;
    actingLegalEntityId?: string | undefined;
    maxAutoBidAmount: number;
    autoBidStepAmount: number;
    idempotencyKey?: string;
  }): Promise<BiddingRouteOutcome<Bid | AutoBidSettings>> {
    const entity = resolveActingBuyerLegalEntity({
      actingLegalEntityId: input.actingLegalEntityId,
    });
    if (entity.isErr()) return { kind: "err", error: entity.error };

    const result = await this.autoBidService.setAutoBid({
      lotId: input.lotId,
      placedByUserId: input.placedByUserId,
      buyerLegalEntityId: entity.value,
      maxAutoBidAmount: input.maxAutoBidAmount,
      autoBidStepAmount: input.autoBidStepAmount,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    });
    if (result.isErr()) return biddingRouteFromBidError(result.error);
    return { kind: "ok", data: result.value, status: 200 };
  }

  async clearAutoBid(input: {
    lotId: string;
    placedByUserId: string;
  }): Promise<BiddingRouteOutcome<{ cleared: number }>> {
    const result = await this.autoBidService.clearAutoBid(input);
    if (result.isErr()) return biddingRouteFromBidError(result.error);
    return { kind: "ok", data: result.value };
  }
}
