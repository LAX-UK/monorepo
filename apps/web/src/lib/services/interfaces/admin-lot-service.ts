import type {
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  updateLotSchema,
} from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
export type CancelLotBody = z.infer<typeof cancelLotBodySchema>;
export type BulkLotsBody = z.infer<typeof bulkLotsBodySchema>;

export interface IAdminLotService {
  create(input: CreateLotInput): Promise<ServiceResult<{ id: string }>>;
  update(id: string, input: UpdateLotInput): Promise<ServiceResult<Record<string, unknown>>>;
  publish(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  cancel(id: string, body: CancelLotBody): Promise<ServiceResult<Record<string, unknown>>>;
  bulk(body: BulkLotsBody): Promise<ServiceResult<Record<string, unknown>>>;
}
