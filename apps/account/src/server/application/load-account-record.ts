import { cookies } from "next/headers";
import { getLaxAccountContainer } from "../container";
import type { SessionHandle } from "../ports/portfolio-gateway";
import type { StaffSessionRecord } from "../ports/session-store";
import { revalidateAccountSession } from "./revalidate-account-session";

/**
 * The signed-in person's live session (tokens refreshed when due) with the id it is stored
 * under, or null when nobody is signed in. Throws when the session store cannot be reached, so
 * callers can tell "signed out" from "unknown".
 */
export async function loadAccountSessionHandle(): Promise<SessionHandle | null> {
  const container = getLaxAccountContainer();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(container.cookies.sessionCookie)?.value;
  if (!sessionId) return null;
  const record = await revalidateAccountSession({
    sessionId,
    sessions: container.sessions,
    tokenEndpoint: container.tokenEndpoint,
    sessionTtlSeconds: container.config.sessionTtlSeconds,
  });
  return record ? { sessionId, record } : null;
}

export async function loadAccountRecord(): Promise<StaffSessionRecord | null> {
  return (await loadAccountSessionHandle())?.record ?? null;
}
