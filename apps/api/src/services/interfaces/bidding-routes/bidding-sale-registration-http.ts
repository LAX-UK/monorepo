import type { SaleRegistrationRow } from "../sale-registration-service.js";
import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export interface IBiddingSaleRegistrationHttpApplicationService {
  requestRegistration(input: {
    userId: string;
    saleId: string;
    actingLegalEntityId?: string | undefined;
    bodyLegalEntityId: string;
    bidLimit?: number;
  }): Promise<BiddingRouteOutcome<SaleRegistrationRow>>;

  listMineForSale(input: {
    userId: string;
    saleId: string;
  }): Promise<BiddingRouteOutcome<{ items: SaleRegistrationRow[] }>>;
}
