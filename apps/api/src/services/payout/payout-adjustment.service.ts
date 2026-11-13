import type { Database } from "@auction/db";
import {
  type PayoutRepoForTx,
  PayoutAdjustmentService as SharedPayoutAdjustmentService,
} from "@auction/finance-runtime";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type {
  AddPaymentPayoutLineInput,
  GiveBackFailedRefundInput,
  IPayoutAdjustmentService,
} from "../interfaces/payout-adjustment.js";
import { bridgePayoutAdjustmentService } from "./finance-payout-bridge.js";

export { PayoutAdjustmentService as SharedPayoutAdjustmentService } from "@auction/finance-runtime";

/** API-facing wrapper around shared finance-runtime payout adjustments. */
export class PayoutAdjustmentService implements IPayoutAdjustmentService {
  private readonly inner: SharedPayoutAdjustmentService;
  private readonly bridged: ReturnType<typeof bridgePayoutAdjustmentService>;

  constructor(
    transactionRunner: ITransactionRunner,
    repo: IPayoutRepository,
    resolveRepoForTx?: PayoutRepoForTx,
  ) {
    this.inner = new SharedPayoutAdjustmentService(transactionRunner, repo, resolveRepoForTx);
    this.bridged = bridgePayoutAdjustmentService(this.inner);
  }

  addPaymentLineToOpenPayoutOrCreateClawback(input: AddPaymentPayoutLineInput): Promise<void> {
    return this.bridged.addPaymentLineToOpenPayoutOrCreateClawback(input);
  }

  giveBackFailedRefund(input: GiveBackFailedRefundInput): Promise<{ sellerPence: number }> {
    return this.bridged.giveBackFailedRefund(input);
  }

  lockOpenPayoutsForSellers(input: {
    legalEntityIds: readonly string[];
    tx: Database;
  }): Promise<void> {
    return this.bridged.lockOpenPayoutsForSellers(input);
  }

  recalculateTotalsFromLines(repo: IPayoutRepository, payoutId: string): Promise<void> {
    return this.bridged.recalculateTotalsFromLines(repo, payoutId);
  }
}
