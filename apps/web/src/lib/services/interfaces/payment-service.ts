import type { createPaymentBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;

export interface IPaymentService {
  createPayment(body: CreatePaymentBody): Promise<ServiceResult<Record<string, unknown>>>;
}
