import { typedPlaceBidRefusal } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
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
    memberRole?: LegalEntityMemberRole | undefined;
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
      memberRole: input.memberRole,
      maxAmount: input.maxAmount,
    });
    const outcome = biddingRouteFromServiceResult(result, 201);
    if (outcome.kind !== "err") return outcome;
    const typed = typedPlaceBidRefusal(outcome.error.code, outcome.error.details);
    return typed
      ? { kind: "err", error: { ...outcome.error, code: typed.code, details: typed.details } }
      : outcome;
  }
}
