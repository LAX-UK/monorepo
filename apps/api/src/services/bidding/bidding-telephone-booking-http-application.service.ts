import type { TelephoneBidBooking } from "@auction/types";
import {
  type BiddingRouteOutcome,
  biddingRouteFromServiceResult,
} from "../interfaces/bidding-routes/bidding-route-http.js";
import type { IBiddingTelephoneBookingHttpApplicationService } from "../interfaces/bidding-routes/bidding-telephone-booking-http.js";
import type { ITelephoneBidBookingBuyerService } from "../interfaces/telephone-bid-booking-service.js";

export class BiddingTelephoneBookingHttpApplicationService
  implements IBiddingTelephoneBookingHttpApplicationService
{
  constructor(private readonly buyer: ITelephoneBidBookingBuyerService) {}

  async requestBooking(
    input: Parameters<IBiddingTelephoneBookingHttpApplicationService["requestBooking"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    const result = await this.buyer.requestBooking({
      userId: input.userId,
      saleId: input.saleId,
      buyerLegalEntityId: input.buyerLegalEntityId,
      ...(input.lotIds !== undefined ? { lotIds: input.lotIds } : {}),
      ...(input.authorizedMax !== undefined ? { authorizedMax: input.authorizedMax } : {}),
      ...(input.buyerNotes !== undefined ? { buyerNotes: input.buyerNotes } : {}),
    });
    return biddingRouteFromServiceResult(result, 201);
  }

  async findMineForSale(
    input: Parameters<IBiddingTelephoneBookingHttpApplicationService["findMineForSale"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking | null>> {
    const booking = await this.buyer.findMineForSale(input.saleId, input.userId);
    return { kind: "ok", data: booking };
  }

  async listMineForUser(
    input: Parameters<IBiddingTelephoneBookingHttpApplicationService["listMineForUser"]>[0],
  ): Promise<BiddingRouteOutcome<{ items: TelephoneBidBooking[] }>> {
    const items = await this.buyer.listMineForUser(input.userId);
    return { kind: "ok", data: { items } };
  }

  async getDetailForUser(
    input: Parameters<IBiddingTelephoneBookingHttpApplicationService["getDetailForUser"]>[0],
  ): Promise<
    BiddingRouteOutcome<
      import("../interfaces/telephone-bid-booking-service-errors.js").TelephoneBidBookingDetail
    >
  > {
    const result = await this.buyer.getDetailForUser(input.bookingId, input.userId);
    return biddingRouteFromServiceResult(result);
  }

  async addLotsOfInterest(
    input: Parameters<IBiddingTelephoneBookingHttpApplicationService["addLotsOfInterest"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    const result = await this.buyer.addLotsOfInterest({
      bookingId: input.bookingId,
      userId: input.userId,
      lotIds: input.lotIds,
    });
    return biddingRouteFromServiceResult(result);
  }

  async requestLimitIncrease(
    input: Parameters<IBiddingTelephoneBookingHttpApplicationService["requestLimitIncrease"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    const result = await this.buyer.requestLimitIncrease({
      bookingId: input.bookingId,
      userId: input.userId,
      amount: input.amount,
    });
    return biddingRouteFromServiceResult(result);
  }

  async cancelByBuyer(
    input: Parameters<IBiddingTelephoneBookingHttpApplicationService["cancelByBuyer"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    const result = await this.buyer.cancelByBuyer({
      bookingId: input.bookingId,
      userId: input.userId,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    });
    return biddingRouteFromServiceResult(result);
  }
}
