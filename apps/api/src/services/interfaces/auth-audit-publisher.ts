export interface IAuthAuditPublisher {
  publish(input: {
    eventType: string;
    aggregateId: string;
    aggregateType?: string;
    payload: Record<string, unknown>;
    actorUserId?: string | null;
  }): Promise<void>;
}
