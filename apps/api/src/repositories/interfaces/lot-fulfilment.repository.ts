import type { LotFulfilmentAddressSnapshot } from "../../services/interfaces/lot-fulfilment-payment-hook.js";
import type {
  LotFulfilmentListRow,
  LotFulfilmentRow,
} from "../../services/interfaces/lot-fulfilment-service.js";

export type InsertLotFulfilmentInput = {
  lotId: string;
  paymentId: string;
  status: LotFulfilmentRow["status"];
  addressSnapshot?: LotFulfilmentAddressSnapshot | null;
};

export type UpdateLotFulfilmentInput = Partial<{
  paymentId: string;
  status: LotFulfilmentRow["status"];
  addressSnapshot: LotFulfilmentAddressSnapshot | null;
  releaseApprovedByUserId: string;
  releaseApprovedAt: Date;
  notes: string | null;
  fulfilmentMethod: LotFulfilmentRow["fulfilmentMethod"];
  shippingCarrier: string;
  trackingNumber: string;
  collectedBy: string;
  collectedAt: Date;
  updatedAt: Date;
}>;

export interface ILotFulfilmentRepository {
  findByLotId(lotId: string): Promise<LotFulfilmentRow | null>;
  insert(input: InsertLotFulfilmentInput): Promise<void>;
  updateByLotId(lotId: string, patch: UpdateLotFulfilmentInput): Promise<void>;
  listForAdmin(options?: {
    status?: LotFulfilmentRow["status"];
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: LotFulfilmentListRow[];
    total: number;
    statusCounts: Record<string, number>;
  }>;
}
