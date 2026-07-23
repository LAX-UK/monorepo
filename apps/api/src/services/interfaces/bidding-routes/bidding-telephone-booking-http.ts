import type { TelephoneBidBooking } from "@auction/types";
import type { TelephoneBidBookingDetail } from "../telephone-bid-booking-service-errors.js";
import type { BiddingRouteOutcome } from "./bidding-route-http.js";

export interface IBiddingTelephoneBookingHttpApplicationService {
  requestBooking(input: {
    userId: string;
    saleId: string;
    buyerLegalEntityId: string;
    lotIds?: string[];
    authorizedMax?: number;
    buyerNotes?: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;

  findMineForSale(input: {
    saleId: string;
    userId: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking | null>>;

  listMineForUser(input: {
    userId: string;
  }): Promise<BiddingRouteOutcome<{ items: TelephoneBidBooking[] }>>;

  getDetailForUser(input: {
    bookingId: string;
    userId: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBookingDetail>>;

  addLotsOfInterest(input: {
    bookingId: string;
    userId: string;
    lotIds: string[];
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;

  requestLimitIncrease(input: {
    bookingId: string;
    userId: string;
    amount: number;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;

  cancelByBuyer(input: {
    bookingId: string;
    userId: string;
    reason?: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;
}
