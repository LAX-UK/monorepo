import type { TelephoneBidBooking } from "@auction/types";

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

export interface ITelephoneBidBookingDetailReader {
  enrichForUser(
    booking: {
      id: string;
      saleId: string;
    } & Record<string, unknown>,
  ): Promise<TelephoneBidBookingDetail>;
}
