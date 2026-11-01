import type { Bid } from "@auction/types";
import { resolveActingBuyerLegalEntity } from "../../lib/resolve-acting-buyer-legal-entity.js";
import type { AutoBidService, AutoBidSettings } from "../auto-bid.service.js";
import type { IBiddingAutoBidHttpApplicationService } from "../interfaces/bidding-routes/bidding-auto-bid-http.js";
import {
  type BiddingRouteOutcome,
  biddingRouteFromBidError,
} from "../interfaces/bidding-routes/bidding-route-http.js";
import type { IBidRefusalObserver } from "./bid-limit-refusal.notifier.js";

export class BiddingAutoBidHttpApplicationService implements IBiddingAutoBidHttpApplicationService {
  constructor(
    private readonly autoBidService: AutoBidService,
    /** Told about refused maximums (for the bidding-limit notices); never delays the answer. */
    private readonly refusals: IBidRefusalObserver | null = null,
  ) {}

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
    if (result.isErr()) {
      void this.refusals
        ?.refused({
          placedByUserId: input.placedByUserId,
          buyerLegalEntityId: entity.value,
          lotId: input.lotId,
          amount: input.maxAutoBidAmount,
          error: result.error,
        })
        .catch(() => undefined);
      return biddingRouteFromBidError(result.error);
    }
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
