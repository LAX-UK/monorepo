import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type { CreatePaymentBody, IPaymentService } from "../interfaces/payment-service";

export class PaymentService implements IPaymentService {
  constructor(private readonly api: IAuthedApiClient) {}

  async createPayment(body: CreatePaymentBody): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}
