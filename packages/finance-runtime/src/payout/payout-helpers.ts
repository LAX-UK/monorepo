import type { Database } from "@auction/db";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import { DrizzlePayoutRepository } from "@auction/persistence/repositories";
import type { IDomainEventSinkPort } from "../domain-event-sink-port.js";
import type { PayoutAdjustmentService } from "./payout-adjustment.service.js";

export function payoutRepoForTx(_rootRepo: IPayoutRepository, tx: Database): IPayoutRepository {
  return new DrizzlePayoutRepository(tx);
}

export type PayoutSettlementDeps = {
  repo: IPayoutRepository;
  transactionRunner: import("@auction/persistence/interfaces").ITransactionRunner | null;
  domainEventSink: IDomainEventSinkPort | null;
  payoutAdjustments: PayoutAdjustmentService | undefined;
  payoutRepoForTx: (tx: Database) => IPayoutRepository;
};

export const DEFAULT_CURRENCY = "GBP";

export function settlementAmounts(p: {
  amount: string;
  platformFee: string;
  settlementAmount?: string;
}): {
  saleAmount: string;
  platformFee: string;
} {
  const saleAmount = p.settlementAmount ?? p.amount;
  const full = Number.parseFloat(p.amount);
  const ratio = full > 0 ? Number.parseFloat(saleAmount) / full : 1;
  return {
    saleAmount,
    platformFee: (Number.parseFloat(p.platformFee) * ratio).toFixed(2),
  };
}
