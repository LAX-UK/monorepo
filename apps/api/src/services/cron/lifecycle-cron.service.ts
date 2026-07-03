import type { INotificationOutboxProcessor } from "../interfaces/notification-outbox.js";
import type { LotLifecycleService } from "../lot-lifecycle.service.js";
import type { SaleLifecycleService } from "../sale-lifecycle.service.js";

export class LifecycleCronService {
  constructor(
    private readonly lotLifecycleService: LotLifecycleService,
    private readonly saleLifecycleService: SaleLifecycleService,
    private readonly notificationOutboxProcessor: INotificationOutboxProcessor,
  ) {}

  async runLotLifecycleTick() {
    await this.lotLifecycleService.runTransitions();
    await this.saleLifecycleService.reconcileSaleStatuses();
    return { ok: true as const };
  }

  async processNotificationOutbox() {
    return this.notificationOutboxProcessor.processBatch(50);
  }
}
