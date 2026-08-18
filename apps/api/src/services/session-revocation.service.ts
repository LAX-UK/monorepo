import type {
  IIdentitySessionClient,
  IdentitySession,
} from "./interfaces/identity-issuer-client.js";

/** Identity-owned session operations exposed through the auth issuer boundary. */
export class SessionRevocationService {
  constructor(private readonly identity: IIdentitySessionClient) {}

  async revokeAllForUser(userId: string): Promise<number> {
    return this.identity.revokeAllSessions(userId);
  }

  /** Revoke all sessions except the exact cookie session. */
  async revokeAllForUserExcept(userId: string, exceptSessionToken: string): Promise<void> {
    await this.identity.revokeAllSessions(userId, exceptSessionToken);
  }

  async listForUser(userId: string, currentSessionToken?: string): Promise<IdentitySession[]> {
    return this.identity.listSessions(userId, currentSessionToken);
  }

  async deleteSessionForUser(userId: string, sessionId: string): Promise<boolean> {
    return this.identity.revokeSession(userId, sessionId);
  }

  async getSessionIdForCookieToken(userId: string, token: string): Promise<string | null> {
    const sessions = await this.identity.listSessions(userId, token);
    return sessions.find((session) => session.isCurrent)?.id ?? null;
  }
}
