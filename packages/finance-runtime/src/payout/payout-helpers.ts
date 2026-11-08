import type { Database } from "@auction/db";
import type {
  IPayoutRepository,
  IPrivateSaleDealPayoutStore,
} from "@auction/persistence/interfaces";
import {
  DrizzlePayoutRepository,
  DrizzlePrivateSaleDealPayoutStore,
} from "@auction/persistence/repositories";
import type { IDomainEventSinkPort } from "../domain-event-sink-port.js";
import type { PayoutAdjustmentService } from "./payout-adjustment.service.js";

export function payoutRepoForTx(_rootRepo: IPayoutRepository, tx: Database): IPayoutRepository {
  return new DrizzlePayoutRepository(tx);
}

export function dealPayoutsForTx(tx: Database): IPrivateSaleDealPayoutStore {
  return new DrizzlePrivateSaleDealPayoutStore(tx);
}

export type PayoutSettlementDeps = {
  repo: IPayoutRepository;
  /** Released private sale deals the run also pays out; left out where deals are not in use. */
  dealPayouts?: IPrivateSaleDealPayoutStore | undefined;
  dealPayoutsForTx?: ((tx: Database) => IPrivateSaleDealPayoutStore) | undefined;
  transactionRunner: import("@auction/persistence/interfaces").ITransactionRunner | null;
  domainEventSink: IDomainEventSinkPort | null;
  payoutAdjustments: PayoutAdjustmentService | undefined;
  payoutRepoForTx: (tx: Database) => IPayoutRepository;
};

export const DEFAULT_CURRENCY = "GBP";

/** The sellers with something to pay out: captured lot payments and released, paid deals. */
export async function listSettlementEntityIds(deps: PayoutSettlementDeps): Promise<string[]> {
  const [lots, deals] = await Promise.all([
    deps.repo.listLegalEntityIdsWithUnlinkedCapturedPayments(),
    deps.dealPayouts?.listSellerLegalEntityIdsWithUnsettledReleased() ?? [],
  ]);
  return [...new Set([...lots, ...deals])];
}

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
