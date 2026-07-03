import type { ITelephoneBidBookingSaleroomBridge } from "../interfaces/telephone-bid-booking-service.js";
import type { TelephoneBidBookingContext } from "./telephone-bid-booking-context.js";

export class TelephoneBidBookingSaleroomBridgeService
  implements ITelephoneBidBookingSaleroomBridge
{
  constructor(private readonly ctx: TelephoneBidBookingContext) {}

  async closeAllOpenForSale(saleId: string): Promise<number> {
    return this.ctx.repo.closeAllOpenForSale(saleId);
  }

  async completeLinesForLot(saleId: string, lotId: string): Promise<number> {
    return this.ctx.repo.completeLinesForLot(saleId, lotId);
  }

  async removeLotFromActiveBookings(saleId: string, lotId: string): Promise<number> {
    return this.ctx.repo.removeLotFromActiveBookings(saleId, lotId);
  }
}
