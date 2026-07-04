import type { ILotFulfilmentRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import type { ILotFulfilmentService } from "./interfaces/lot-fulfilment-service.js";
import { LotFulfilmentAdminService } from "./lot-fulfilment/lot-fulfilment-admin.service.js";
import { LotFulfilmentBuyerService } from "./lot-fulfilment/lot-fulfilment-buyer.service.js";
import { createLotFulfilmentContext } from "./lot-fulfilment/lot-fulfilment-context.js";
import { LotFulfilmentPaymentSyncService } from "./lot-fulfilment/lot-fulfilment-payment-sync.service.js";

export type {
  LotFulfilmentListRow,
  LotFulfilmentRow,
  LotFulfilmentServiceError,
} from "./interfaces/lot-fulfilment-service.js";

export class LotFulfilmentService implements ILotFulfilmentService {
  private readonly buyer: LotFulfilmentBuyerService;
  private readonly admin: LotFulfilmentAdminService;
  private readonly paymentSync: LotFulfilmentPaymentSyncService;

  constructor(lotRepo: ILotRepository, fulfilmentRepo: ILotFulfilmentRepository) {
    const ctx = createLotFulfilmentContext({
      fulfilmentRepo,
      lotRepo,
    });
    this.buyer = new LotFulfilmentBuyerService(ctx);
    this.admin = new LotFulfilmentAdminService(ctx);
    this.paymentSync = new LotFulfilmentPaymentSyncService(ctx);
  }

  ensureAwaitingPayment(
    ...args: Parameters<LotFulfilmentPaymentSyncService["ensureAwaitingPayment"]>
  ) {
    return this.paymentSync.ensureAwaitingPayment(...args);
  }

  onPaymentCaptured(...args: Parameters<LotFulfilmentPaymentSyncService["onPaymentCaptured"]>) {
    return this.paymentSync.onPaymentCaptured(...args);
  }

  getForWinner(...args: Parameters<LotFulfilmentBuyerService["getForWinner"]>) {
    return this.buyer.getForWinner(...args);
  }

  listForAdmin(...args: Parameters<LotFulfilmentAdminService["listForAdmin"]>) {
    return this.admin.listForAdmin(...args);
  }

  getByLotIdForAdmin(...args: Parameters<LotFulfilmentAdminService["getByLotIdForAdmin"]>) {
    return this.admin.getByLotIdForAdmin(...args);
  }

  approveRelease(...args: Parameters<LotFulfilmentAdminService["approveRelease"]>) {
    return this.admin.approveRelease(...args);
  }

  markShipped(...args: Parameters<LotFulfilmentAdminService["markShipped"]>) {
    return this.admin.markShipped(...args);
  }

  markReadyForCollection(...args: Parameters<LotFulfilmentAdminService["markReadyForCollection"]>) {
    return this.admin.markReadyForCollection(...args);
  }

  markDelivered(...args: Parameters<LotFulfilmentAdminService["markDelivered"]>) {
    return this.admin.markDelivered(...args);
  }

  markCollected(...args: Parameters<LotFulfilmentAdminService["markCollected"]>) {
    return this.admin.markCollected(...args);
  }
}
