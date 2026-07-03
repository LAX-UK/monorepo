import type { TelephoneBidBooking, TelephoneBidBookingStatus } from "@auction/types";

export type TelephoneBidBookingRow = TelephoneBidBooking;

export type TelephoneBidBookingAdminRow = TelephoneBidBookingRow & {
  userEmail: string | null;
  userName: string | null;
  buyerLegalEntityDisplayName: string | null;
};

export type InsertTelephoneBidBookingRow = {
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  phoneE164: string;
  lotIds?: string[];
  authorizedMax?: string | null;
  buyerNotes?: string | null;
};

export type ITelephoneBidBookingRepository = {
  findById(id: string): Promise<TelephoneBidBookingRow | null>;
  findByIdForUser(id: string, userId: string): Promise<TelephoneBidBookingRow | null>;
  findActiveForSaleUserEntity(input: {
    saleId: string;
    userId: string;
    buyerLegalEntityId: string;
  }): Promise<TelephoneBidBookingRow | null>;
  findMineForSale(saleId: string, userId: string): Promise<TelephoneBidBookingRow | null>;
  listMineForUser(userId: string): Promise<TelephoneBidBookingRow[]>;
  listForSaleAdmin(
    saleId: string,
    status?: TelephoneBidBookingStatus,
  ): Promise<TelephoneBidBookingAdminRow[]>;
  listForCurrentLot(saleId: string, lotId: string): Promise<TelephoneBidBookingAdminRow[]>;
  insert(row: InsertTelephoneBidBookingRow): Promise<TelephoneBidBookingRow>;
  update(
    id: string,
    patch: Partial<{
      lotIds: string[];
      authorizedMax: string | null;
      status: TelephoneBidBookingStatus;
      clerkUserId: string | null;
      notes: string | null;
      approvedByUserId: string | null;
      confirmedAt: Date | null;
      completedLotIds: string[];
      limitIncreaseRequestedAt: Date | null;
      limitIncreaseAmount: string | null;
      cancelledAt: Date | null;
      cancelledByUserId: string | null;
      cancellationReason: string | null;
    }>,
  ): Promise<TelephoneBidBookingRow | null>;
  countBySaleStatus(saleId: string, status: TelephoneBidBookingStatus): Promise<number>;
  countGlobalByStatus(status: TelephoneBidBookingStatus): Promise<number>;
  closeAllOpenForSale(saleId: string): Promise<number>;
  completeLinesForLot(saleId: string, lotId: string): Promise<number>;
  removeLotFromActiveBookings(saleId: string, lotId: string): Promise<number>;
};
