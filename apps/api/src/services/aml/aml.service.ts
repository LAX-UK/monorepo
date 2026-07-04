import type { ITransactionRunner } from "@auction/persistence";
import type { VeriffWebhookVerifier } from "../../lib/veriff/veriff-webhook-verifier.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { createAmlServiceDeps } from "./aml-context.js";
import type { AmlMonitoringService } from "./aml-monitoring.service.js";
import { AmlReviewApplicationService } from "./aml-review-application.service.js";
import { AmlWebhookIngestService } from "./aml-webhook-ingest.service.js";
import type {
  IAmlDecisionPolicy,
  IAmlHoldStore,
  IAmlService,
  IScreeningProvider,
  IWatchlistScreeningFetcher,
  IWatchlistScreeningReader,
  IWatchlistScreeningWriter,
} from "./ports.js";

export {
  AML_SCREENING_EVALUATED_EVENT,
  AML_MATCH_FLAGGED_EVENT,
} from "./aml-webhook-ingest.service.js";
export type {
  AmlReviewInput,
  AmlTriageInput,
  AmlWatchlistWebhookResult,
} from "./ports.js";

/**
 * AML migration facade. Delegates to segregated ingest, review, and monitoring
 * services while preserving the original public surface for container wiring.
 */
export class AmlService implements IAmlService {
  private readonly ingest: AmlWebhookIngestService;
  private readonly review: AmlReviewApplicationService;
  private readonly monitoring: AmlMonitoringService;

  constructor(
    transactionRunner: ITransactionRunner,
    verifier: VeriffWebhookVerifier,
    policy: IAmlDecisionPolicy,
    screeningWriter: IWatchlistScreeningWriter,
    screeningReader: IWatchlistScreeningReader,
    holdStore: IAmlHoldStore,
    events: IDomainEventSink,
    provider: IScreeningProvider,
    fetcher: IWatchlistScreeningFetcher | null = null,
  ) {
    const deps = createAmlServiceDeps({
      transactionRunner,
      policy,
      screeningWriter,
      screeningReader,
      holdStore,
      events,
      provider,
    });
    this.monitoring = deps.monitoring;
    this.ingest = new AmlWebhookIngestService(deps, verifier, fetcher, this.monitoring);
    this.review = new AmlReviewApplicationService(deps, this.monitoring);
  }

  isConfigured(...args: Parameters<AmlMonitoringService["isConfigured"]>) {
    return this.monitoring.isConfigured(...args);
  }

  enableMonitoring(...args: Parameters<AmlMonitoringService["enableMonitoring"]>) {
    return this.monitoring.enableMonitoring(...args);
  }

  handleWatchlistWebhook(...args: Parameters<AmlWebhookIngestService["handleWatchlistWebhook"]>) {
    return this.ingest.handleWatchlistWebhook(...args);
  }

  ingestFromFetch(...args: Parameters<AmlWebhookIngestService["ingestFromFetch"]>) {
    return this.ingest.ingestFromFetch(...args);
  }

  listPendingReviews(...args: Parameters<AmlReviewApplicationService["listPendingReviews"]>) {
    return this.review.listPendingReviews(...args);
  }

  countPendingReviews(...args: Parameters<AmlReviewApplicationService["countPendingReviews"]>) {
    return this.review.countPendingReviews(...args);
  }

  listForUser(...args: Parameters<AmlReviewApplicationService["listForUser"]>) {
    return this.review.listForUser(...args);
  }

  triage(...args: Parameters<AmlReviewApplicationService["triage"]>) {
    return this.review.triage(...args);
  }

  decide(...args: Parameters<AmlReviewApplicationService["decide"]>) {
    return this.review.decide(...args);
  }
}
