import type { Database } from "@auction/db";
import { SellerTermsPolicy } from "@auction/domain";
import type {
  IPayoutRepository,
  IPrivateSaleDealPayoutStore,
} from "@auction/persistence/interfaces";
import {
  DrizzleCommissionVatSettingReader,
  DrizzlePayoutRepository,
  DrizzlePrivateSaleDealPayoutStore,
  DrizzleSaleSellerTermsStore,
  DrizzleSellerTermsFactsReader,
} from "@auction/persistence/repositories";
import type { IDomainEventSinkPort } from "../domain-event-sink-port.js";
import type { PayoutAdjustmentService } from "./payout-adjustment.service.js";
import { type ISettlementSellerTerms, SettlementSellerTerms } from "./settlement-seller-terms.js";

export function payoutRepoForTx(_rootRepo: IPayoutRepository, tx: Database): IPayoutRepository {
  return new DrizzlePayoutRepository(tx);
}

export function dealPayoutsForTx(tx: Database): IPrivateSaleDealPayoutStore {
  return new DrizzlePrivateSaleDealPayoutStore(tx);
}

/**
 * The seller terms a payout run pays from, for a transaction scope: the signed agreement's rule,
 * read and stored through the run's own transaction.
 */
export function settlementSellerTermsForTx(tx: Database): ISettlementSellerTerms {
  return new SettlementSellerTerms(
    new SellerTermsPolicy(
      new DrizzleSellerTermsFactsReader(tx),
      new DrizzleCommissionVatSettingReader(tx),
    ),
    new DrizzleSaleSellerTermsStore(tx),
  );
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
  /** Where each sale stands for the run: paid from its seller terms, held, or LAX's own. */
  sellerTermsForTx: (tx: Database) => ISettlementSellerTerms;
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
