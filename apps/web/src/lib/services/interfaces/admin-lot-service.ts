import type {
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  returnLotToInventoryBodySchema,
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
export type UpdateLotMarketingDetailsInput = z.infer<typeof updateLotMarketingDetailsSchema>;
export type CancelLotBody = z.infer<typeof cancelLotBodySchema>;
export type BulkLotsBody = z.infer<typeof bulkLotsBodySchema>;
export type ReturnLotToInventoryBody = z.infer<typeof returnLotToInventoryBodySchema>;

export interface IAdminLotService {
  create(input: CreateLotInput): Promise<ServiceResult<{ id: string }>>;
  update(id: string, input: UpdateLotInput): Promise<ServiceResult<Record<string, unknown>>>;
  updateMarketingDetails(
    id: string,
    input: UpdateLotMarketingDetailsInput,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  publish(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  cancel(id: string, body: CancelLotBody): Promise<ServiceResult<Record<string, unknown>>>;
  bulk(body: BulkLotsBody): Promise<ServiceResult<Record<string, unknown>>>;
  returnToInventory(
    id: string,
    body: ReturnLotToInventoryBody,
  ): Promise<ServiceResult<Record<string, unknown>>>;
}
