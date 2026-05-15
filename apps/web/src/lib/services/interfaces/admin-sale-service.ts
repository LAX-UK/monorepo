import type { LotStatus } from "@auction/types";
import type {
  cancelSaleBodySchema,
  createSaleSchema,
  markSaleEndedBodySchema,
  updateLotStatusBodySchema,
  updateSaleSchema,
} from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type CancelSaleBody = z.infer<typeof cancelSaleBodySchema>;
export type MarkSaleEndedBody = z.infer<typeof markSaleEndedBodySchema>;
export type UpdateLotStatusBody = z.infer<typeof updateLotStatusBodySchema>;

export interface IAdminSaleService {
  create(input: CreateSaleInput): Promise<ServiceResult<{ id: string }>>;
  update(id: string, input: UpdateSaleInput): Promise<ServiceResult<Record<string, unknown>>>;
  publish(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  unpublish(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  cancel(id: string, body: CancelSaleBody): Promise<ServiceResult<Record<string, unknown>>>;
  attachLot(saleId: string, lotId: string): Promise<ServiceResult<Record<string, unknown>>>;
  detachLot(saleId: string, lotId: string): Promise<ServiceResult<Record<string, unknown>>>;
  markEnded(id: string, body: MarkSaleEndedBody): Promise<ServiceResult<Record<string, unknown>>>;
  cancelLot(
    saleId: string,
    lotId: string,
    body: CancelSaleBody,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  setLotStatus(
    saleId: string,
    lotId: string,
    status: LotStatus,
    reason?: string,
  ): Promise<ServiceResult<Record<string, unknown>>>;
}
