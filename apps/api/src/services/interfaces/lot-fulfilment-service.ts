import type {
  LotFulfilmentAddressSnapshot,
  LotFulfilmentListRow,
  LotFulfilmentRow,
} from "@auction/persistence";
import type { Result } from "neverthrow";

export type { LotFulfilmentListRow, LotFulfilmentRow } from "@auction/persistence";

export type LotFulfilmentServiceError = { message: string; status: number; code?: string };

export interface ILotFulfilmentBuyerService {
  getForWinner(
    userId: string,
    lotId: string,
  ): Promise<Result<LotFulfilmentRow | null, LotFulfilmentServiceError>>;
}

export interface ILotFulfilmentAdminService {
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
  getByLotIdForAdmin(lotId: string): Promise<LotFulfilmentRow | null>;
  approveRelease(input: {
    lotId: string;
    actorUserId: string;
    notes?: string | undefined;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>>;
  markShipped(input: {
    lotId: string;
    actorUserId: string;
    carrier: string;
    trackingNumber: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>>;
  markReadyForCollection(input: {
    lotId: string;
    actorUserId: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>>;
  markDelivered(input: {
    lotId: string;
    actorUserId: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>>;
  markCollected(input: {
    lotId: string;
    actorUserId: string;
    collectedBy: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>>;
}

export interface ILotFulfilmentPaymentSyncService {
  ensureAwaitingPayment(
    lotId: string,
    paymentId: string,
    addressSnapshot?: LotFulfilmentAddressSnapshot | null,
  ): Promise<void>;
  onPaymentCaptured(lotId: string, paymentId: string): Promise<void>;
}

export interface ILotFulfilmentService
  extends ILotFulfilmentBuyerService,
    ILotFulfilmentAdminService,
    ILotFulfilmentPaymentSyncService {}
