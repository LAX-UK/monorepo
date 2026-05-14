import { apiBaseUrl } from "@/lib/auth/api-base";

export type SessionApiError = "forbidden" | "not_found" | "server_error";

export type SessionDeleteResult = { ok: true } | { ok: false; error: SessionApiError };
export type SessionRevokeAllResult = { ok: true } | { ok: false; error: SessionApiError };

function classifyError(status: number): SessionApiError {
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  return "server_error";
}

/** DELETE /users/me/sessions/:id — revoke a single session. */
export async function deleteSession(id: string): Promise<SessionDeleteResult> {
  const res = await fetch(`${apiBaseUrl()}/users/me/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) return { ok: false, error: classifyError(res.status) };
  return { ok: true };
}

/** POST /users/me/sessions/revoke-all — revoke all sessions except the current one. */
export async function revokeAllSessions(): Promise<SessionRevokeAllResult> {
  const res = await fetch(`${apiBaseUrl()}/users/me/sessions/revoke-all`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return { ok: false, error: classifyError(res.status) };
  return { ok: true };
}
