import type { Database } from "@auction/db";
import { DrizzlePayoutRepository } from "@auction/persistence";
import type { IPayoutRepository } from "@auction/persistence";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";

/** Resolve payout repo for a transaction scope. */
export function payoutRepoForTx(_rootRepo: IPayoutRepository, tx: Database): IPayoutRepository {
  return new DrizzlePayoutRepository(tx);
}

/** Resolved deps record built once in PayoutService constructor (post-default coalescing). */
export type PayoutServiceDeps = {
  repo: IPayoutRepository;
  transactionRunner: import("@auction/persistence").ITransactionRunner | null;
  domainEventSink: IDomainEventSink | undefined;
  payoutAdjustments: IPayoutAdjustmentService | undefined;
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
