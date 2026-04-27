import type { ServiceResult } from "../http/service-result";

export type AdminPaymentXeroSyncResult = { ok: boolean; error?: string };

export interface IAdminPaymentOpsService {
  capture(paymentId: string): Promise<ServiceResult<Record<string, unknown>>>;
  refund(paymentId: string): Promise<ServiceResult<Record<string, unknown>>>;
  xeroSync(paymentId: string): Promise<ServiceResult<AdminPaymentXeroSyncResult>>;
}
