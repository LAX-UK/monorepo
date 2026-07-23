import type { IRefundReconcileCronRunner, IStalePaymentMaintenance } from "./ports.js";

export class PaymentMaintenanceCronService {
  constructor(
    private readonly paymentMaintenance: IStalePaymentMaintenance,
    private readonly refundReconcile: IRefundReconcileCronRunner,
  ) {}

  async expireStalePayments(pendingExpireDays: number, authorizedExpireDays: number) {
    const expired = await this.paymentMaintenance.expireStalePendingPayments(
      pendingExpireDays,
      authorizedExpireDays,
    );
    return { expired };
  }

  async retryRefundReconciles() {
    return this.refundReconcile.replayPending(25);
  }
}
