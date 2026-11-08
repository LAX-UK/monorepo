import type { Database } from "@auction/db";
import { type SettlementPeriodResult, resolveSettlementPeriod } from "@auction/domain";
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

/**
 * The period a cron settlement covers for one seller: it follows the seller's last payout and
 * ends at `periodEnd`; a first run starts at the oldest waiting captured payment. This is the same
 * resolver the staff run-settlement uses.
 */
export async function resolveEntitySettlementPeriod(
  deps: PayoutSettlementDeps,
  legalEntityId: string,
  periodEnd: Date,
): Promise<SettlementPeriodResult> {
  const [latest] = await deps.repo.list({ legalEntityId, limit: 1 });
  const pending = await deps.repo.findUnlinkedCapturedPayments(legalEntityId);
  return resolveSettlementPeriod({
    now: periodEnd,
    lastSettledEnd: latest?.periodEnd ?? null,
    earliestPending: pending.reduce<Date | null>(
      (oldest, p) => (p.capturedAt && (!oldest || p.capturedAt < oldest) ? p.capturedAt : oldest),
      null,
    ),
  });
}
