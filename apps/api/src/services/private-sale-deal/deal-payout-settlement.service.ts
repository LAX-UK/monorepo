import type { IPrivateSaleDealPayoutStore } from "@auction/persistence/interfaces";
import type { DealTransitionService } from "./deal-transition.service.js";

export type DealPayoutSettlementResult = { settled: number; skipped: number; failed: number };

/** What the settlement cron calls once the payout run has finished. */
export interface IDealPayoutSettler {
  settlePaidPayouts(): Promise<DealPayoutSettlementResult>;
}

const BATCH = 100;

/**
 * Settles each released deal whose payout has been paid. It reads the paid payouts rather than
 * waiting for one event, so a payout marked paid by the provider, by reconciliation or by staff
 * all settle the deal, and running it twice changes nothing.
 */
export class DealPayoutSettlementService implements IDealPayoutSettler {
  constructor(
    private readonly deps: {
      payouts: Pick<IPrivateSaleDealPayoutStore, "listReleasedWithPaidPayout">;
      transitions: Pick<DealTransitionService, "transition">;
    },
  ) {}

  async settlePaidPayouts(): Promise<DealPayoutSettlementResult> {
    const due = await this.deps.payouts.listReleasedWithPaidPayout(BATCH);
    const result: DealPayoutSettlementResult = { settled: 0, skipped: 0, failed: 0 };
    for (const { dealId, payoutId } of due) {
      try {
        const outcome = await this.deps.transitions.transition(dealId, "settle", {
          actorUserId: null,
        });
        if (outcome.kind === "ok") result.settled += 1;
        else result.skipped += 1;
      } catch (e) {
        result.failed += 1;
        console.error(
          JSON.stringify({
            msg: "private_sale_settle_failed",
            dealId,
            payoutId,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
    }
    return result;
  }
}
