import type { AccountIdentityGateway } from "../ports/account-identity-gateway";
import type { SessionStore } from "../ports/session-store";

/**
 * After a step-up sign-in the browser holds a new Account session and a new issuer session, and
 * the ones it replaced would linger as a second "this browser" in Where you're signed in. Ends
 * the old Account session and, with the fresh sign-in as proof, the old issuer session.
 *
 * Best effort: the person is already signed in again, so a failure only leaves the old entry
 * listed, where they can sign it out themselves.
 */
export async function retireReplacedSession(input: {
  replacedSessionId: string | undefined;
  newSessionId: string;
  sessions: SessionStore;
  identity: Pick<AccountIdentityGateway, "revokeSession">;
}): Promise<void> {
  const { replacedSessionId, newSessionId, sessions, identity } = input;
  if (!replacedSessionId || replacedSessionId === newSessionId) return;
  try {
    const [replaced, current] = await Promise.all([
      sessions.get(replacedSessionId),
      sessions.get(newSessionId),
    ]);
    await sessions.delete(replacedSessionId);
    if (!replaced || !current || replaced.subject !== current.subject) return;
    if (!replaced.sid || replaced.sid === current.sid) return;
    await identity.revokeSession(
      { accessToken: current.accessToken, sid: current.sid },
      replaced.sid,
    );
  } catch (error) {
    console.warn("account_replaced_session_not_retired", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}
