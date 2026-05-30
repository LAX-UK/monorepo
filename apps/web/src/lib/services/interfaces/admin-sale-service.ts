import type { LotStatus } from "@auction/types";
import type {
  bulkSalesBodySchema,
  cancelSaleBodySchema,
  createNestedLotForSaleSchema,
  createSaleSchema,
  markSaleEndedBodySchema,
  updateLotStatusBodySchema,
  updateSaleSchema,
} from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreateNestedLotForSaleInput = z.infer<typeof createNestedLotForSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type CancelSaleBody = z.infer<typeof cancelSaleBodySchema>;
export type MarkSaleEndedBody = z.infer<typeof markSaleEndedBodySchema>;
export type UpdateLotStatusBody = z.infer<typeof updateLotStatusBodySchema>;
export type BulkSalesBody = z.infer<typeof bulkSalesBodySchema>;

export interface IAdminSaleService {
  create(input: CreateSaleInput): Promise<ServiceResult<{ id: string }>>;
  update(id: string, input: UpdateSaleInput): Promise<ServiceResult<Record<string, unknown>>>;
  publish(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  unpublish(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  cancel(id: string, body: CancelSaleBody): Promise<ServiceResult<Record<string, unknown>>>;
  softDelete(id: string, confirmationPhrase: string): Promise<ServiceResult<void>>;
  bulk(body: BulkSalesBody): Promise<ServiceResult<Record<string, unknown>>>;
  createNestedLot(
    saleId: string,
    input: CreateNestedLotForSaleInput,
  ): Promise<ServiceResult<{ id: string }>>;
  attachLot(
    saleId: string,
    lotId: string,
    via?: "attach_endpoint" | "wizard",
  ): Promise<ServiceResult<Record<string, unknown>>>;
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
