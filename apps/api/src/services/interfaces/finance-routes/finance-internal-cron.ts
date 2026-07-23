import type { PaymentMaintenanceCronService } from "@auction/finance-cron-app";
import type { SettlementCronService } from "../../cron/settlement-cron.service.js";

export type BulkPayoutSettlementCronResult =
  | { ok: true; data: { settlement: unknown; transfers: unknown } }
  | { ok: false; status: 409; body: { reason: string } }
  | { ok: false; status: 503; body: { error: string; code?: string } };

export interface IInternalCronApplicationService {
  runBulkPayoutSettlementWithLock(input: {
    settlementDisabled: boolean;
  }): Promise<BulkPayoutSettlementCronResult>;
  syncXeroPayoutBill(payoutId: string): ReturnType<SettlementCronService["syncXeroPayoutBill"]>;
  expireStalePayments(
    pendingExpireDays: number,
    authorizedExpireDays: number,
  ): ReturnType<PaymentMaintenanceCronService["expireStalePayments"]>;
  retryRefundReconciles(): ReturnType<PaymentMaintenanceCronService["retryRefundReconciles"]>;
}
