import type { SessionStore } from "../ports/session-store";

/**
 * After a step-up sign-in the browser holds a new LAX Account session, and the one it replaced
 * would sit unreachable in the store until it expires. Removes that entry.
 *
 * Only LAX Account's own store is touched: the sign-in service replaces the browser's sign-in
 * record itself, and ending anything there would sign the person out of LAX Bid, LAX Shop and
 * lax.art in the same browser. Best effort: the person is already signed in again.
 */
export async function discardReplacedSession(input: {
  replacedSessionId: string | undefined;
  newSessionId: string;
  sessions: Pick<SessionStore, "delete">;
}): Promise<void> {
  const { replacedSessionId, newSessionId, sessions } = input;
  if (!replacedSessionId || replacedSessionId === newSessionId) return;
  try {
    await sessions.delete(replacedSessionId);
  } catch (error) {
    console.warn("account_replaced_session_not_discarded", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}
