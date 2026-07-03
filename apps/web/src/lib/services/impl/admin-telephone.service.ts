import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceFailure, serviceSuccess } from "../http/service-result";
import type {
  AdminTelephonePlaceBidInput,
  IAdminTelephoneService,
} from "../interfaces/admin-telephone-service";

function telephoneBookingPath(saleId: string, bookingId: string, suffix: string): string {
  return `/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings/${encodeURIComponent(bookingId)}/${suffix}`;
}

export class AdminTelephoneService implements IAdminTelephoneService {
  constructor(private readonly api: IAuthedApiClient) {}

  bookingAction(saleId: string, bookingId: string, action: string, body?: Record<string, unknown>) {
    return this.api.json<unknown>(telephoneBookingPath(saleId, bookingId, action), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  updateNotes(saleId: string, bookingId: string, notes: string) {
    return this.api.json<unknown>(telephoneBookingPath(saleId, bookingId, "notes"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
  }

  async placeBid(input: AdminTelephonePlaceBidInput): Promise<ServiceResult<{ bidId: string }>> {
    const r = await this.api.json<{ data?: { id?: string } }>("/admin/saleroom/telephone-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lotId: input.lotId,
        buyerUserId: input.buyerUserId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        amount: input.amount,
        ...(input.maxAutoBidAmount != null ? { maxAutoBidAmount: input.maxAutoBidAmount } : {}),
        ...(input.telephoneBookingId ? { telephoneBookingId: input.telephoneBookingId } : {}),
      }),
    });
    if (!r.ok) return r;
    const bidId = r.data?.data?.id;
    if (!bidId) {
      return serviceFailure("Unexpected response from server", r.status, r.data);
    }
    return serviceSuccess({ bidId }, r.status);
  }
}
