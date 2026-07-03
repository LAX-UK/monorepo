import type { Database } from "@auction/db";
import type { ISourceOfFundsGate } from "../aml/settlement-compliance.policy.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type {
  ISourceOfFundsService,
  SourceOfFundsConfig,
} from "../interfaces/source-of-funds-service.js";
import { SourceOfFundsGateService } from "./source-of-funds-gate.service.js";
import { SourceOfFundsReviewService } from "./source-of-funds-review.service.js";
import type { ISourceOfFundsRepository } from "./source-of-funds.types.js";

export { SOURCE_OF_FUNDS_REQUIRED_EVENT } from "./source-of-funds-gate.service.js";
export { SOURCE_OF_FUNDS_REVIEWED_EVENT } from "./source-of-funds-review.service.js";
export type {
  SourceOfFundsConfig,
  SourceOfFundsDecideCommand,
  SourceOfFundsTriageCommand,
} from "../interfaces/source-of-funds-service.js";

/**
 * Source-of-Funds migration facade. Delegates to segregated gate (payment hot
 * path) and review (admin triage) services while preserving the original
 * public surface for container wiring.
 */
export class SourceOfFundsService implements ISourceOfFundsService, ISourceOfFundsGate {
  private readonly gate: SourceOfFundsGateService;
  private readonly review: SourceOfFundsReviewService;

  constructor(
    repo: ISourceOfFundsRepository,
    config: SourceOfFundsConfig,
    db: Database | null = null,
    events: DomainEventPublisher | null = null,
  ) {
    this.gate = new SourceOfFundsGateService(repo, config, db, events);
    this.review = new SourceOfFundsReviewService(repo, db, events);
  }

  requiresSourceOfFunds(...args: Parameters<SourceOfFundsGateService["requiresSourceOfFunds"]>) {
    return this.gate.requiresSourceOfFunds(...args);
  }

  hasPendingCaseForUser(...args: Parameters<SourceOfFundsGateService["hasPendingCaseForUser"]>) {
    return this.gate.hasPendingCaseForUser(...args);
  }

  listPending(...args: Parameters<SourceOfFundsReviewService["listPending"]>) {
    return this.review.listPending(...args);
  }

  countPending(...args: Parameters<SourceOfFundsReviewService["countPending"]>) {
    return this.review.countPending(...args);
  }

  countByStatus(...args: Parameters<SourceOfFundsReviewService["countByStatus"]>) {
    return this.review.countByStatus(...args);
  }

  listByStatus(...args: Parameters<SourceOfFundsReviewService["listByStatus"]>) {
    return this.review.listByStatus(...args);
  }

  triage(...args: Parameters<SourceOfFundsReviewService["triage"]>) {
    return this.review.triage(...args);
  }

  decide(...args: Parameters<SourceOfFundsReviewService["decide"]>) {
    return this.review.decide(...args);
  }

  reopenRejected(...args: Parameters<SourceOfFundsReviewService["reopenRejected"]>) {
    return this.review.reopenRejected(...args);
  }
}
