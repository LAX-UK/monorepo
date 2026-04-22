import type { ServiceResult } from "../http/service-result";

export interface IAdminPaymentOpsService {
  capture(paymentId: string): Promise<ServiceResult<Record<string, unknown>>>;
  refund(paymentId: string): Promise<ServiceResult<Record<string, unknown>>>;
}
