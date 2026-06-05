import type { TelephoneBidBooking, TelephoneBidBookingStatus } from "@auction/types";
import type { Result } from "neverthrow";
import type { TelephoneBidBookingAdminRow } from "../../repositories/interfaces/telephone-bid-booking.repository.js";

export type TelephoneBidBookingServiceError = {
  message: string;
  status: number;
  code?: string;
};

export type TelephoneBidBookingDetail = TelephoneBidBooking & {
  saleTitle: string | null;
  linkedBids: Array<{
    id: string;
    lotId: string;
    amount: string;
    isWinning: boolean;
    createdAt: Date;
  }>;
};

export interface ITelephoneBidBookingService {
  requestBooking(input: {
    userId: string;
    saleId: string;
    buyerLegalEntityId: string;
    lotIds?: string[];
    authorizedMax?: number;
    buyerNotes?: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  listMineForUser(userId: string): Promise<TelephoneBidBooking[]>;
  findMineForSale(saleId: string, userId: string): Promise<TelephoneBidBooking | null>;
  getDetailForUser(
    id: string,
    userId: string,
  ): Promise<Result<TelephoneBidBookingDetail, TelephoneBidBookingServiceError>>;

  addLotsOfInterest(input: {
    bookingId: string;
    userId: string;
    lotIds: string[];
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  requestLimitIncrease(input: {
    bookingId: string;
    userId: string;
    amount: number;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  cancelByBuyer(input: {
    bookingId: string;
    userId: string;
    reason?: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  listForSaleAdmin(
    saleId: string,
    status?: TelephoneBidBookingStatus,
  ): Promise<TelephoneBidBookingAdminRow[]>;

  listForCurrentLot(saleId: string, lotId: string): Promise<TelephoneBidBookingAdminRow[]>;

  confirm(input: {
    bookingId: string;
    staffUserId: string;
    notes?: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  assignClerk(input: {
    bookingId: string;
    staffUserId: string;
    clerkUserId: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  updateNotes(input: {
    bookingId: string;
    staffUserId: string;
    notes: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  approveLimitIncrease(input: {
    bookingId: string;
    staffUserId: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  startLine(input: {
    bookingId: string;
    staffUserId: string;
    lotId: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  completeLine(input: {
    bookingId: string;
    staffUserId: string;
    lotId: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  closeBooking(input: {
    bookingId: string;
    staffUserId: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  cancelByStaff(input: {
    bookingId: string;
    staffUserId: string;
    reason?: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  closeAllOpenForSale(saleId: string): Promise<number>;
  completeLinesForLot(saleId: string, lotId: string): Promise<number>;
  removeLotFromActiveBookings(saleId: string, lotId: string): Promise<number>;

  countPendingForSale(saleId: string): Promise<number>;
  countGlobalPending(): Promise<number>;

  assertBookingBelongsToSale(
    bookingId: string,
    saleId: string,
  ): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;

  assertBookingAllowsTelephoneBid(input: {
    bookingId: string;
    saleId: string;
    lotId: string;
    amount: number;
    maxAutoBidAmount?: number;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;
}
