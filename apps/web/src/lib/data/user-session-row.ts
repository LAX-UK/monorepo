/** Better Auth session row for `/users/me/sessions` (shared server + client). */
export type UserSessionRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastPasswordAuthAt: string | null;
  isCurrent: boolean;
};

export type SessionsLoadError = "unauthorized" | "forbidden" | "suspended" | "server_error";

export type MySessionsLoadResult =
  | { ok: true; sessions: UserSessionRow[] }
  | { ok: false; error: SessionsLoadError };
