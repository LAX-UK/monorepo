import type { ServiceResult } from "../http/service-result";

export interface IAdminSaleRegistrationsService {
  approve(saleId: string, registrationId: string): Promise<ServiceResult<unknown>>;
  reject(saleId: string, registrationId: string, reason?: string): Promise<ServiceResult<unknown>>;
  updateBidLimit(
    saleId: string,
    registrationId: string,
    bidLimit: number | null,
  ): Promise<ServiceResult<unknown>>;
}
