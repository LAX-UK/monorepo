export interface IImpersonationDomainEventReader {
  findStartedEvent(input: {
    sessionId: string;
    actorUserId: string;
  }): Promise<{ actingLegalEntityId: string | null } | null>;
  hasEndedEvent(sessionId: string): Promise<boolean>;
}
