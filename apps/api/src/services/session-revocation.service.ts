import type { ISessionRepository } from "../repositories/interfaces/session.repository.js";
import type { AuthSessionListRow } from "../repositories/session.types.js";

/** Deletes Better Auth `session` rows (auth DB). Used after password reset / email change / suspension. */
export class SessionRevocationService {
  constructor(private readonly sessions: ISessionRepository) {}

  async revokeAllForUser(userId: string): Promise<number> {
    return this.sessions.deleteAllForUser(userId);
  }

  /** Revoke all sessions except the current one (e.g. after email change while keeping this browser signed in). */
  async revokeAllForUserExcept(userId: string, exceptSessionId: string): Promise<void> {
    await this.sessions.deleteAllForUserExcept(userId, exceptSessionId);
  }

  async listForUser(userId: string): Promise<AuthSessionListRow[]> {
    return this.sessions.listForUser(userId);
  }

  async deleteSessionForUser(userId: string, sessionId: string): Promise<boolean> {
    return this.sessions.deleteSessionForUser(userId, sessionId);
  }

  async getSessionIdForCookieToken(userId: string, token: string): Promise<string | null> {
    return this.sessions.getSessionIdForCookieToken(userId, token);
  }
}
