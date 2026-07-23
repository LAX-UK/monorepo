import { resolveActingBuyerLegalEntity } from "../../lib/resolve-acting-buyer-legal-entity.js";
import {
  type BiddingRouteOutcome,
  biddingRouteFromServiceResult,
} from "../interfaces/bidding-routes/bidding-route-http.js";
import type { IBiddingSaleRegistrationHttpApplicationService } from "../interfaces/bidding-routes/bidding-sale-registration-http.js";
import type { ISaleRegistrationBuyerService } from "../interfaces/sale-registration-service.js";

export class BiddingSaleRegistrationHttpApplicationService
  implements IBiddingSaleRegistrationHttpApplicationService
{
  constructor(private readonly saleRegistrationBuyer: ISaleRegistrationBuyerService) {}

  async requestRegistration(input: {
    userId: string;
    saleId: string;
    actingLegalEntityId?: string | undefined;
    bodyLegalEntityId: string;
    bidLimit?: number;
  }): Promise<
    BiddingRouteOutcome<import("../interfaces/sale-registration-service.js").SaleRegistrationRow>
  > {
    const entity = resolveActingBuyerLegalEntity({
      actingLegalEntityId: input.actingLegalEntityId,
      bodyLegalEntityId: input.bodyLegalEntityId,
    });
    if (entity.isErr()) return { kind: "err", error: entity.error };

    const result = await this.saleRegistrationBuyer.requestRegistration({
      userId: input.userId,
      saleId: input.saleId,
      buyerLegalEntityId: entity.value,
      ...(input.bidLimit !== undefined ? { bidLimit: input.bidLimit } : {}),
    });
    return biddingRouteFromServiceResult(result, 201);
  }

  async listMineForSale(input: {
    userId: string;
    saleId: string;
  }): Promise<
    BiddingRouteOutcome<{
      items: import("../interfaces/sale-registration-service.js").SaleRegistrationRow[];
    }>
  > {
    const items = await this.saleRegistrationBuyer.listMineForSale(input);
    return { kind: "ok", data: { items } };
  }
}
