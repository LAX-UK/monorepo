import type { PaymentMaintenanceCronService } from "@auction/finance-cron-app";
import type { Redis } from "ioredis";
import type { SettlementCronService } from "../cron/settlement-cron.service.js";
import type {
  BulkPayoutSettlementCronResult,
  IInternalCronApplicationService,
} from "../interfaces/finance-routes/finance-internal-cron.js";
import type { IDealPayoutSettler } from "../private-sale-deal/deal-payout-settlement.service.js";

export const BULK_PAYOUT_SETTLEMENT_LOCK_KEY = "payout:settlement:lock";
const BULK_PAYOUT_SETTLEMENT_LOCK_TTL_SEC = 30 * 60;

export class InternalCronApplicationService implements IInternalCronApplicationService {
  constructor(
    private readonly redis: Redis,
    private readonly settlementCronService: SettlementCronService,
    private readonly paymentMaintenanceCronService: PaymentMaintenanceCronService,
    private readonly dealPayoutSettler: IDealPayoutSettler | null = null,
  ) {}

  async runBulkPayoutSettlementWithLock(input: {
    settlementDisabled: boolean;
  }): Promise<BulkPayoutSettlementCronResult> {
    const lockOk = await this.redis.set(
      BULK_PAYOUT_SETTLEMENT_LOCK_KEY,
      "1",
      "EX",
      BULK_PAYOUT_SETTLEMENT_LOCK_TTL_SEC,
      "NX",
    );
    if (lockOk !== "OK") {
      return { ok: false, status: 409, body: { reason: "settlement_already_running" } };
    }

    try {
      if (input.settlementDisabled) {
        return {
          ok: false,
          status: 503,
          body: { error: "payout_settlement_disabled", code: "payout_settlement_disabled" },
        };
      }
      const bulk = await this.settlementCronService.runBulkSettlement();
      // Deals whose payout has gone through are settled after every run, so a payout that was
      // paid since the last run settles its deal too.
      await this.dealPayoutSettler?.settlePaidPayouts();
      return {
        ok: true,
        data: {
          settlement: bulk.settlement,
          transfers: bulk.transfers,
        },
      };
    } finally {
      await this.redis.del(BULK_PAYOUT_SETTLEMENT_LOCK_KEY);
    }
  }

  syncXeroPayoutBill(payoutId: string) {
    return this.settlementCronService.syncXeroPayoutBill(payoutId);
  }

  expireStalePayments(pendingExpireDays: number, authorizedExpireDays: number) {
    return this.paymentMaintenanceCronService.expireStalePayments(
      pendingExpireDays,
      authorizedExpireDays,
    );
  }

  retryRefundReconciles() {
    return this.paymentMaintenanceCronService.retryRefundReconciles();
  }
}
