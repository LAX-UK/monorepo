import type { IDomainEventSink } from "../../domain-event-sink.js";

export const DATA_REQUEST_AGGREGATE = "data_request";

/** What staff did: opened a record, or logged, edited, extended, closed or continued a request. */
export const DATA_REQUEST_AUDIT_ACTIONS = [
  "viewed",
  "logged",
  "updated",
  "extended",
  "closed",
  "continued",
] as const;
export type DataRequestAuditAction = (typeof DATA_REQUEST_AUDIT_ACTIONS)[number];

/** Bid's record of staff using the Data requests screen. */
export interface IDataRequestAuditTrail {
  record(input: {
    action: DataRequestAuditAction;
    reference: string;
    actorUserId: string;
  }): Promise<void>;
}

/**
 * Writes one domain event per view and action: who, which request and what they did. The payload
 * is the reference only, never the person's contact details or the notes; the event type is the
 * action and the actor is the event's actor.
 */
export class DomainEventDataRequestAuditTrail implements IDataRequestAuditTrail {
  constructor(private readonly sink: IDomainEventSink) {}

  async record(input: {
    action: DataRequestAuditAction;
    reference: string;
    actorUserId: string;
  }): Promise<void> {
    await this.sink.publish({
      aggregateType: DATA_REQUEST_AGGREGATE,
      aggregateId: input.reference,
      eventType: `data_request.${input.action}`,
      payload: { reference: input.reference },
      producer: "apps/api",
      actorUserId: input.actorUserId,
    });
  }
}
