import type { TelephoneBidBookingAdminRow } from "@auction/persistence/interfaces";
import type { TelephoneBidBooking, TelephoneBidBookingStatus } from "@auction/types";
import type { Result } from "neverthrow";
import type {
  TelephoneBidBookingDetail,
  TelephoneBidBookingServiceError,
} from "./telephone-bid-booking-service-errors.js";

export interface ITelephoneBidBookingBuyerService {
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
}

export interface ITelephoneBidBookingStaffService {
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

  assertBookingBelongsToSale(
    bookingId: string,
    saleId: string,
  ): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;
}

export interface ITelephoneBidBookingQueryService {
  listForSaleAdmin(
    saleId: string,
    status?: TelephoneBidBookingStatus,
  ): Promise<TelephoneBidBookingAdminRow[]>;

  listForCurrentLot(saleId: string, lotId: string): Promise<TelephoneBidBookingAdminRow[]>;

  countPendingForSale(saleId: string): Promise<number>;
  countGlobalPending(): Promise<number>;
}

export interface ITelephoneBidBookingSaleroomBridge {
  closeAllOpenForSale(saleId: string): Promise<number>;
  completeLinesForLot(saleId: string, lotId: string): Promise<number>;
  removeLotFromActiveBookings(saleId: string, lotId: string): Promise<number>;
}

export interface ITelephoneBidBookingBidPolicy {
  assertBookingAllowsTelephoneBid(input: {
    bookingId: string;
    saleId: string;
    lotId: string;
    amount: number;
    maxAutoBidAmount?: number;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>>;
}

export type ITelephoneBidBookingService = ITelephoneBidBookingBuyerService &
  ITelephoneBidBookingStaffService &
  ITelephoneBidBookingQueryService &
  ITelephoneBidBookingSaleroomBridge &
  ITelephoneBidBookingBidPolicy;
