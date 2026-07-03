import type { ServiceResult } from "../http/service-result";

export interface IAdminSaleroomService {
  goLive(saleId: string): Promise<ServiceResult<unknown>>;
  pause(saleId: string): Promise<ServiceResult<unknown>>;
  resume(saleId: string): Promise<ServiceResult<unknown>>;
  advance(saleId: string, lotId: string): Promise<ServiceResult<unknown>>;
  hammer(saleId: string): Promise<ServiceResult<unknown>>;
  noSale(saleId: string): Promise<ServiceResult<unknown>>;
  close(saleId: string): Promise<ServiceResult<unknown>>;
  displayApprove(saleId: string, userCode: string): Promise<ServiceResult<unknown>>;
  displayOverlay(
    saleId: string,
    kind: "fair_warning" | "announcement",
    message?: string,
  ): Promise<ServiceResult<unknown>>;
  displayClearOverlay(saleId: string): Promise<ServiceResult<unknown>>;
  displayRevoke(saleId: string, pairingId: string): Promise<ServiceResult<unknown>>;
}
