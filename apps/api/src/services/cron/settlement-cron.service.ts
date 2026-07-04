import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { Env } from "../../env.js";
import { createBaseLogger } from "../../lib/logger.js";
import type { XeroPayoutBillWriter } from "../accounting/xero-payout-bill.writer.js";
import type { IPayoutSettlementService } from "../interfaces/payout.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import type { LotInvoiceInitiationService } from "../lot-invoice-initiation.service.js";

export class SettlementCronService {
  constructor(
    private readonly payoutSettlementService: IPayoutSettlementService,
    private readonly stripeConnectService: IStripeConnectService,
    private readonly xeroPayoutBillWriter: XeroPayoutBillWriter | null,
    private readonly lotInvoiceInitiationService: LotInvoiceInitiationService,
    private readonly repoFactory: IRepositoryFactory,
    private readonly env: Env,
  ) {}

  async runBulkSettlement() {
    const log = createBaseLogger(this.env).child({ component: "bulk_payout_settlement" });
    return this.payoutSettlementService.runBulkSettlementWithTransfers(null, {
      initiateTransfer: (payoutId, opts) =>
        this.stripeConnectService.initiateTransfer(payoutId, opts),
      onEntityOutcome: (row) => {
        log.info(
          {
            legalEntityId: row.legalEntityId,
            payoutId: row.payoutId,
            outcome: row.outcome,
            resume: row.resume ?? false,
            reason: row.reason,
            stripeErrorCode: row.stripeErrorCode,
          },
          "bulk_payout_settlement_entity",
        );
      },
    });
  }

  async syncXeroPayoutBill(payoutId: string) {
    if (!this.xeroPayoutBillWriter) {
      return { ok: false as const, error: "xero_payout_bill_disabled" };
    }
    const data = await this.xeroPayoutBillWriter.syncPaidPayout(payoutId);
    return { ok: true as const, data };
  }

  async ensureLotInvoice(lotId: string) {
    const data = await this.lotInvoiceInitiationService.ensureForLot(lotId);
    return data;
  }

  async ensureLotInvoices() {
    const lotIds = await this.repoFactory.root.lot.listSoldLotsMissingPayment(50);
    const settled = await Promise.allSettled(
      lotIds.map((id) => this.lotInvoiceInitiationService.ensureForLot(id)),
    );
    const results = settled.map((outcome, index) => {
      if (outcome.status === "fulfilled") return outcome.value;
      return {
        created: false,
        reason: "ensure_failed",
        lotId: lotIds[index],
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      };
    });
    return {
      processed: lotIds.length,
      created: results.filter((r) => r.created).length,
      failed: settled.filter((r) => r.status === "rejected").length,
      results,
    };
  }
}
