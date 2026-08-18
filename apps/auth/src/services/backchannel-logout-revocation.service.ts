import type { RpLogoutRepository } from "./backchannel-logout.ports.js";

export class BackchannelLogoutRevocationCoordinator {
  constructor(
    private readonly repository: RpLogoutRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  revokeIdentitySessions(identitySessionIds: readonly string[]): Promise<number> {
    if (identitySessionIds.length === 0) return Promise.resolve(0);
    return this.repository.revokeIdentitySessionsAndEnqueue(identitySessionIds, this.now());
  }

  revokeSubject(subjectId: string): Promise<number> {
    return this.repository.revokeSubjectAndEnqueue(subjectId, this.now());
  }

  revokeClientSubject(clientId: string, subjectId: string): Promise<number> {
    return this.repository.revokeClientSubjectAndEnqueue(clientId, subjectId, this.now());
  }
}

export type BackchannelLogoutRevoker = Pick<
  BackchannelLogoutRevocationCoordinator,
  "revokeIdentitySessions" | "revokeSubject" | "revokeClientSubject"
>;
