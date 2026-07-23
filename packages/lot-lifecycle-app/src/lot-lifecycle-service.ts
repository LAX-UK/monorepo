import type { ClerkLotOutcomeService } from "./clerk-lot-outcome.service.js";
import type { TimedLotTransitionRunner } from "./timed-lot-transition-runner.js";

/** Scheduled status transitions (scheduled→active, active→ended + winner),
 * Dutch price decrements, and single-lot job hooks for BullMQ.
 */
export class LotLifecycleService {
  constructor(
    private readonly clerkOutcomes: ClerkLotOutcomeService,
    private readonly timedRunner: TimedLotTransitionRunner,
  ) {}

  async runDutchDecrements(now: Date = new Date()): Promise<void> {
    return this.timedRunner.runDutchDecrements(now);
  }

  async runTransitions(now: Date = new Date()): Promise<void> {
    return this.timedRunner.runTransitions(now);
  }

  async finalizeActiveLotFromClerkHammer(
    lotId: string,
  ): Promise<{ winnerId: string | null; voided: boolean } | null> {
    return this.clerkOutcomes.finalizeActiveLotFromClerkHammer(lotId);
  }

  async noSaleEndActiveLotFromClerk(lotId: string): Promise<boolean> {
    return this.clerkOutcomes.noSaleEndActiveLotFromClerk(lotId);
  }

  async finalizeActiveLotsPastEnd(saleId: string, now: Date = new Date()): Promise<number> {
    return this.clerkOutcomes.finalizeActiveLotsPastEnd(saleId, now);
  }

  async processActivateJob(lotId: string, now: Date = new Date()): Promise<void> {
    return this.timedRunner.processActivateJob(lotId, now);
  }

  async processEndJob(lotId: string, now: Date = new Date()): Promise<void> {
    return this.timedRunner.processEndJob(lotId, now);
  }
}
