import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import { userSessionRowSchema } from "@/lib/data/http/sessions.schema";
import type { MySessionsLoadResult } from "@/lib/data/user-session-row";

/** Active Better Auth sessions for the signed-in user (`GET /users/me/sessions`). */
export async function getServerMySessions(): Promise<MySessionsLoadResult> {
  const res = await authedServerFetch("/users/me/sessions", { cache: "no-store" });
  if (res.status === 401) return { ok: false, error: "unauthorized" };
  if (res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as { code?: string };
    const error =
      typeof body.code === "string" && body.code === "account_suspended"
        ? ("suspended" as const)
        : ("forbidden" as const);
    return { ok: false, error };
  }
  if (!res.ok) return { ok: false, error: "server_error" };
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, userSessionRowSchema, "GET /users/me/sessions");
  return { ok: true, sessions: rows };
}
