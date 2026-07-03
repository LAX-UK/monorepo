import type { IAuthedApiClient } from "../http/authed-api-client";
import type { IAdminSaleRegistrationsService } from "../interfaces/admin-sale-registrations-service";

function registrationPath(saleId: string, registrationId: string, suffix: string): string {
  return `/admin/sales/${encodeURIComponent(saleId)}/registrations/${encodeURIComponent(registrationId)}/${suffix}`;
}

export class AdminSaleRegistrationsService implements IAdminSaleRegistrationsService {
  constructor(private readonly api: IAuthedApiClient) {}

  approve(saleId: string, registrationId: string) {
    return this.api.json<unknown>(registrationPath(saleId, registrationId, "approve"), {
      method: "POST",
    });
  }

  reject(saleId: string, registrationId: string, reason?: string) {
    return this.api.json<unknown>(registrationPath(saleId, registrationId, "reject"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    });
  }

  updateBidLimit(saleId: string, registrationId: string, bidLimit: number | null) {
    return this.api.json<unknown>(registrationPath(saleId, registrationId, "bid-limit"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bidLimit }),
    });
  }
}
