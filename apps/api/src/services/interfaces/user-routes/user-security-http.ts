import type { UserHttpJson } from "./user-route-http.js";

export interface IUserSecurityHttpApplicationService {
  listSessions(input: {
    userId: string;
    sessionTokenFromCookie: string | null;
  }): Promise<UserHttpJson>;

  deleteSession(input: {
    userId: string;
    sessionId: string;
    sessionTokenFromCookie: string | null;
  }): Promise<UserHttpJson>;

  revokeAllSessionsExceptCurrent(input: {
    userId: string;
    sessionTokenFromCookie: string | null;
  }): Promise<UserHttpJson>;

  notifyTwoFactorEnabled(input: { userId: string }): Promise<UserHttpJson>;

  notifyTwoFactorDisabled(input: { userId: string }): Promise<UserHttpJson>;

  requestAccountDeletion(input: { userId: string }): Promise<UserHttpJson>;
}
