import { resolveActingBuyerLegalEntity } from "../../lib/resolve-acting-buyer-legal-entity.js";
import type { AbsenteeBidService } from "../absentee-bid.service.js";
import type { IBiddingAbsenteeBidHttpApplicationService } from "../interfaces/bidding-routes/bidding-absentee-bid-http.js";
import {
  type BiddingRouteOutcome,
  biddingRouteFromServiceResult,
} from "../interfaces/bidding-routes/bidding-route-http.js";

export class BiddingAbsenteeBidHttpApplicationService
  implements IBiddingAbsenteeBidHttpApplicationService
{
  constructor(private readonly absenteeBidService: AbsenteeBidService) {}

  async scheduleAbsentee(input: {
    userId: string;
    lotId: string;
    actingLegalEntityId?: string | undefined;
    bodyLegalEntityId?: string | undefined;
    maxAmount: number;
  }): Promise<BiddingRouteOutcome<{ id: string }>> {
    const entity = resolveActingBuyerLegalEntity({
      actingLegalEntityId: input.actingLegalEntityId,
      bodyLegalEntityId: input.bodyLegalEntityId,
    });
    if (entity.isErr()) return { kind: "err", error: entity.error };

    const result = await this.absenteeBidService.schedule({
      userId: input.userId,
      lotId: input.lotId,
      buyerLegalEntityId: entity.value,
      maxAmount: input.maxAmount,
    });
    return biddingRouteFromServiceResult(result, 201);
  }
}
