export interface IImpersonationDomainEventReader {
  findStartedEvent(input: {
    sessionId: string;
    actorUserId: string;
  }): Promise<{ actingLegalEntityId: string | null } | null>;
  hasEndedEvent(sessionId: string): Promise<boolean>;
  listRecentStartedForActor(
    actorUserId: string,
    limit: number,
  ): Promise<Array<{ aggregateId: string; actingLegalEntityId: string | null }>>;
}
