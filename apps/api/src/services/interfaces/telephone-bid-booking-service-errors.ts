export type TelephoneBidBookingServiceError = {
  message: string;
  status: number;
  code?: string;
};

export type TelephoneBidBookingDetail = import("@auction/types").TelephoneBidBooking & {
  saleTitle: string | null;
  linkedBids: Array<{
    id: string;
    lotId: string;
    amount: string;
    isWinning: boolean;
    createdAt: Date;
  }>;
};
