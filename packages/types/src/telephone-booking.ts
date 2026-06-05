export type TelephoneBidBookingStatus =
  | "requested"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type TelephoneBidBooking = {
  id: string;
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  phoneE164: string;
  lotIds: string[];
  authorizedMax: string | null;
  status: TelephoneBidBookingStatus;
  clerkUserId: string | null;
  notes: string | null;
  buyerNotes: string | null;
  approvedByUserId: string | null;
  completedLotIds: string[];
  limitIncreaseRequestedAt: Date | null;
  limitIncreaseAmount: string | null;
  cancelledAt: Date | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  updatedAt: Date;
};

export type TelephoneBidBookingAdmin = TelephoneBidBooking & {
  userEmail: string | null;
  userName: string | null;
  buyerLegalEntityDisplayName: string | null;
  phoneDisplay: string | null;
};

export type TelephoneBidBookingDetail = TelephoneBidBooking & {
  saleTitle?: string | null;
  linkedBids?: Array<{
    id: string;
    lotId: string;
    amount: string;
    isWinning: boolean;
    createdAt: Date;
  }>;
};
