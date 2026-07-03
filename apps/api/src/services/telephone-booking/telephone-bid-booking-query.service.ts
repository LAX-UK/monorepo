import type { TelephoneBidBookingStatus } from "@auction/types";
import type { ITelephoneBidBookingQueryService } from "../interfaces/telephone-bid-booking-service.js";
import type { TelephoneBidBookingContext } from "./telephone-bid-booking-context.js";

export class TelephoneBidBookingQueryService implements ITelephoneBidBookingQueryService {
  constructor(private readonly ctx: TelephoneBidBookingContext) {}

  async listForSaleAdmin(saleId: string, status?: TelephoneBidBookingStatus) {
    return this.ctx.repo.listForSaleAdmin(saleId, status);
  }

  async listForCurrentLot(saleId: string, lotId: string) {
    return this.ctx.repo.listForCurrentLot(saleId, lotId);
  }

  async countPendingForSale(saleId: string): Promise<number> {
    return this.ctx.repo.countBySaleStatus(saleId, "requested");
  }

  async countGlobalPending(): Promise<number> {
    return this.ctx.repo.countGlobalByStatus("requested");
  }
}
