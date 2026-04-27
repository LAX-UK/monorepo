import type { CreatePaymentResponse } from "@auction/types";
import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type { CreatePaymentBody, IPaymentService } from "../interfaces/payment-service";

export class PaymentService implements IPaymentService {
  constructor(private readonly api: IAuthedApiClient) {}

  async createPayment(body: CreatePaymentBody): Promise<ServiceResult<CreatePaymentResponse>> {
    const r = await this.api.json<{ data: CreatePaymentResponse }>("/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return r;
    return { ok: true, data: r.data.data, status: r.status };
  }
}
