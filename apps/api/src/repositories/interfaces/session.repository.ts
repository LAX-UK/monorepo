import type { AuthSessionListRow } from "../session.types.js";

export interface ISessionRepository {
  deleteAllForUser(userId: string): Promise<number>;

  deleteAllForUserExcept(userId: string, exceptSessionId: string): Promise<void>;

  listForUser(userId: string): Promise<AuthSessionListRow[]>;

  deleteSessionForUser(userId: string, sessionId: string): Promise<boolean>;

  getSessionIdForCookieToken(userId: string, token: string): Promise<string | null>;
}
