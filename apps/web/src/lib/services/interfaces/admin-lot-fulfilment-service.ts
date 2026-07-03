import type { ServiceResult } from "../http/service-result";

export interface IAdminLotFulfilmentService {
  release(lotId: string, body: { notes?: string | undefined }): Promise<ServiceResult<unknown>>;
  ship(
    lotId: string,
    body: { carrier: string; trackingNumber: string },
  ): Promise<ServiceResult<unknown>>;
  readyForCollection(lotId: string): Promise<ServiceResult<unknown>>;
  delivered(lotId: string): Promise<ServiceResult<unknown>>;
  collected(lotId: string, body: { collectedBy: string }): Promise<ServiceResult<unknown>>;
}
