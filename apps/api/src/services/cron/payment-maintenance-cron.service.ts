import type { IPaymentMaintenanceService } from "../interfaces/payment-service.js";
import type { PaymentRefundReconcileService } from "../payment/payment-refund-reconcile.service.js";

export class PaymentMaintenanceCronService {
  constructor(
    private readonly paymentMaintenanceService: IPaymentMaintenanceService,
    private readonly paymentRefundReconcileService: PaymentRefundReconcileService,
  ) {}

  async expireStalePayments(pendingExpireDays: number, authorizedExpireDays: number) {
    const expired = await this.paymentMaintenanceService.expireStalePendingPayments(
      pendingExpireDays,
      authorizedExpireDays,
    );
    return { expired };
  }

  async retryRefundReconciles() {
    return this.paymentRefundReconcileService.replayPending(25);
  }
}
