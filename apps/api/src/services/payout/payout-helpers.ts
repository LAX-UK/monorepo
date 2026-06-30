import type { Database } from "@auction/db";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { IPayoutRepository } from "../interfaces/payout-repository.js";

/** Resolved deps record built once in PayoutService constructor (post-default coalescing). */
export type PayoutServiceDeps = {
  repo: IPayoutRepository;
  db: Database | undefined;
  domainEventPublisher: DomainEventPublisher | undefined;
  payoutAdjustments: IPayoutAdjustmentService | undefined;
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
