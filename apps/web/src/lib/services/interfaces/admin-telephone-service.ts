import type { ServiceResult } from "../http/service-result";

export type AdminTelephonePlaceBidInput = {
  lotId: string;
  buyerUserId: string;
  buyerLegalEntityId: string;
  amount: number;
  maxAutoBidAmount?: number | undefined;
  telephoneBookingId?: string | undefined;
};

export interface IAdminTelephoneService {
  bookingAction(
    saleId: string,
    bookingId: string,
    action: string,
    body?: Record<string, unknown>,
  ): Promise<ServiceResult<unknown>>;
  updateNotes(saleId: string, bookingId: string, notes: string): Promise<ServiceResult<unknown>>;
  placeBid(input: AdminTelephonePlaceBidInput): Promise<ServiceResult<{ bidId: string }>>;
}
