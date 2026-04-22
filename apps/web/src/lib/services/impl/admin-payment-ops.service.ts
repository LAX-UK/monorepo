import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type { IAdminPaymentOpsService } from "../interfaces/admin-payment-ops-service";

export class AdminPaymentOpsService implements IAdminPaymentOpsService {
  constructor(private readonly api: IAuthedApiClient) {}

  async capture(paymentId: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/payments/${encodeURIComponent(paymentId)}/capture`,
      { method: "POST" },
    );
  }

  async refund(paymentId: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      { method: "POST" },
    );
  }
}
