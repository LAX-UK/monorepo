import type { Database } from "@auction/db";
import type {
  IPayoutProcessorReader,
  IPayoutRepository,
  IPrivateSaleDealPayoutStore,
} from "@auction/persistence/interfaces";
import {
  DrizzlePayoutRepository,
  DrizzlePrivateSaleDealPayoutStore,
} from "@auction/persistence/repositories";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { IPayoutProblemNotifier } from "./payout-problem-notifier.js";

/** Resolve payout repo for a transaction scope. */
export function payoutRepoForTx(_rootRepo: IPayoutRepository, tx: Database): IPayoutRepository {
  return new DrizzlePayoutRepository(tx);
}

/** Resolve the released private sale deals a payout run settles, for a transaction scope. */
export function dealPayoutsForTx(tx: Database): IPrivateSaleDealPayoutStore {
  return new DrizzlePrivateSaleDealPayoutStore(tx);
}

/** Resolve who processed a payout, inside a transaction scope. */
export function payoutProcessorReaderForTx(tx: Database): IPayoutProcessorReader {
  return new DrizzlePayoutRepository(tx);
}

/** Resolved deps record built once in PayoutService constructor (post-default coalescing). */
export type PayoutServiceDeps = {
  repo: IPayoutRepository;
  transactionRunner: import("@auction/persistence/interfaces").ITransactionRunner | null;
  domainEventSink: IDomainEventSink | undefined;
  payoutAdjustments: IPayoutAdjustmentService | undefined;
  payoutRepoForTx: (tx: Database) => IPayoutRepository;
  payoutProcessorsForTx: (tx: Database) => IPayoutProcessorReader;
  /** Released private sale deals the settlement run also pays out; `undefined` where unused. */
  dealPayouts?: IPrivateSaleDealPayoutStore | undefined;
  dealPayoutsForTx?: ((tx: Database) => IPrivateSaleDealPayoutStore) | undefined;
  /** Tells the account when a payout fails or is reversed; told after the change commits. */
  problemNotifier?: IPayoutProblemNotifier | undefined;
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
