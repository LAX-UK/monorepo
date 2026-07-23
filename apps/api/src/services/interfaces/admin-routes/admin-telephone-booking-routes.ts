import type { TelephoneBidBookingAdminRow } from "@auction/persistence/interfaces";
import type { TelephoneBidBooking, TelephoneBidBookingStatus } from "@auction/types";
import type { BiddingRouteOutcome } from "../bidding-routes/bidding-route-http.js";

export interface IAdminTelephoneBookingApplicationService {
  countGlobalPending(): Promise<{ count: number }>;

  listForSaleAdmin(input: {
    saleId: string;
    status?: TelephoneBidBookingStatus;
  }): Promise<{ items: TelephoneBidBookingAdminRow[] }>;

  confirm(input: {
    saleId: string;
    bookingId: string;
    staffUserId: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;

  assignClerk(input: {
    saleId: string;
    bookingId: string;
    staffUserId: string;
    clerkUserId: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;

  approveLimitIncrease(input: {
    saleId: string;
    bookingId: string;
    staffUserId: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;

  startLine(input: {
    saleId: string;
    bookingId: string;
    staffUserId: string;
    lotId: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;

  completeLine(input: {
    saleId: string;
    bookingId: string;
    staffUserId: string;
    lotId: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;

  closeBooking(input: {
    saleId: string;
    bookingId: string;
    staffUserId: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;

  cancelByStaff(input: {
    saleId: string;
    bookingId: string;
    staffUserId: string;
    reason?: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;

  updateNotes(input: {
    saleId: string;
    bookingId: string;
    staffUserId: string;
    notes: string;
  }): Promise<BiddingRouteOutcome<TelephoneBidBooking>>;
}

export type AdminTelephoneBookingRouteServices = {
  telephoneBookings: IAdminTelephoneBookingApplicationService;
};
