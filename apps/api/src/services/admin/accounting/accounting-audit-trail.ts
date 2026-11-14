import type { IDomainEventSink } from "../../domain-event-sink.js";
import type { IAccountingAuditTrail } from "../../interfaces/accounting-queue.js";

export const ACCOUNTING_DOCUMENT_AGGREGATE = "accounting_document";
export const ACCOUNTING_RETRY_REQUESTED = "accounting_document.retry_requested";
export const ACCOUNTING_RELEASE_REQUESTED = "accounting_document.release_requested";

/**
 * Writes a try again or a release as a domain event, so it appears in the staff audit log with its
 * actor.
 */
export class DomainEventAccountingAuditTrail implements IAccountingAuditTrail {
  constructor(private readonly sink: IDomainEventSink) {}

  async retryRequested(input: {
    documentId: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.sink.publish({
      aggregateType: ACCOUNTING_DOCUMENT_AGGREGATE,
      aggregateId: input.documentId,
      eventType: ACCOUNTING_RETRY_REQUESTED,
      payload: input.payload,
      producer: "apps/api",
      actorUserId: input.actorUserId,
    });
  }

  async releaseRequested(input: {
    documentId: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.sink.publish({
      aggregateType: ACCOUNTING_DOCUMENT_AGGREGATE,
      aggregateId: input.documentId,
      eventType: ACCOUNTING_RELEASE_REQUESTED,
      payload: input.payload,
      producer: "apps/api",
      actorUserId: input.actorUserId,
    });
  }
}
