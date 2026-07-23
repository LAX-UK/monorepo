import type {
  ILifecycleCronLotRunner,
  ILifecycleCronSaleReconciler,
  INotificationOutboxCronProcessor,
} from "./ports.js";

export class LifecycleCronService {
  constructor(
    private readonly lotLifecycle: ILifecycleCronLotRunner,
    private readonly saleLifecycle: ILifecycleCronSaleReconciler,
    private readonly notificationOutbox: INotificationOutboxCronProcessor,
  ) {}

  async runLotLifecycleTick() {
    await this.lotLifecycle.runTransitions();
    await this.saleLifecycle.reconcileSaleStatuses();
    return { ok: true as const };
  }

  async processNotificationOutbox() {
    return this.notificationOutbox.processBatch(50);
  }
}
