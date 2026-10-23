import { cookies } from "next/headers";
import { getLaxAccountContainer } from "../container";
import type { StaffSessionRecord } from "../ports/session-store";
import { revalidateAccountSession } from "./revalidate-account-session";

/**
 * The signed-in person's live session record (tokens refreshed when due), or null when nobody
 * is signed in. Throws when the session store cannot be reached, so callers can tell "signed
 * out" from "unknown".
 */
export async function loadAccountRecord(): Promise<StaffSessionRecord | null> {
  const container = getLaxAccountContainer();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(container.cookies.sessionCookie)?.value;
  if (!sessionId) return null;
  return revalidateAccountSession({
    sessionId,
    sessions: container.sessions,
    tokenEndpoint: container.tokenEndpoint,
    sessionTtlSeconds: container.config.sessionTtlSeconds,
  });
}
