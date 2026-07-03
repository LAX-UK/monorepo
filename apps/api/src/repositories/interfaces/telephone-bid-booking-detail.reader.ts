import type { TelephoneBidBookingDetail } from "../../services/interfaces/telephone-bid-booking-service-errors.js";

export interface ITelephoneBidBookingDetailReader {
  enrichForUser(
    booking: {
      id: string;
      saleId: string;
    } & Record<string, unknown>,
  ): Promise<TelephoneBidBookingDetail>;
}
