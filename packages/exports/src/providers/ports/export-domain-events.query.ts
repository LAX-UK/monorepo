export type RedactedDomainEventRow = {
  id: number;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  actorUserId: string | null;
  actingLegalEntityId: string | null;
  occurredAt: Date;
};

export interface IExportDomainEventsQuery {
  listRedacted(input: {
    limit: number;
    offset?: number;
    eventTypePrefix?: string;
    aggregateType?: string;
    aggregateId?: string;
    includePii: boolean;
  }): Promise<RedactedDomainEventRow[]>;
  countForExport(input: { aggregateType?: string; aggregateId?: string }): Promise<number>;
}
