export type DomainEventPublishInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  actingLegalEntityId: string | null;
  schemaVersion?: number;
  producer?: string;
};

export interface IDomainEventSinkPort {
  withTx(tx: unknown): {
    publish(event: DomainEventPublishInput): Promise<void>;
  };
}
