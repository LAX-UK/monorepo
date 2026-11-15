import type { SessionStore, StaffSessionRecord } from "../ports/session-store";

const CLAIMED = "claimed";
const REVOKED = "revoked";
const SETTLED = "session:";

export function createMemorySessionStore(): SessionStore {
  const records = new Map<string, StaffSessionRecord>();
  const jtiSeen = new Set<string>();
  /** state → "claimed" | "revoked" | the session id the sign-in created. */
  const pendingLogins = new Map<string, string>();

  return {
    async get(sessionId) {
      return records.get(sessionId) ?? null;
    },
    async save(sessionId, record) {
      records.set(sessionId, record);
    },
    async delete(sessionId) {
      records.delete(sessionId);
    },
    async invalidateBySidOrSubject(input) {
      for (const [sessionId, record] of records) {
        const matches = input.sid ? record.sid === input.sid : record.subject === input.sub;
        if (matches) records.delete(sessionId);
      }
    },
    async claimBackchannelLogoutJti(jti) {
      if (jtiSeen.has(jti)) return false;
      jtiSeen.add(jti);
      return true;
    },
    async releaseBackchannelLogoutJti(jti) {
      jtiSeen.delete(jti);
    },
    async claimPendingLogin(state) {
      if (pendingLogins.has(state)) return false;
      pendingLogins.set(state, CLAIMED);
      return true;
    },
    async isPendingLoginRevoked(state) {
      return pendingLogins.get(state) === REVOKED;
    },
    async settlePendingLogin(state, sessionId) {
      if (pendingLogins.get(state) !== CLAIMED) return false;
      pendingLogins.set(state, `${SETTLED}${sessionId}`);
      return true;
    },
    async revokePendingLogin(state) {
      const previous = pendingLogins.get(state);
      pendingLogins.set(state, REVOKED);
      if (previous?.startsWith(SETTLED)) records.delete(previous.slice(SETTLED.length));
    },
    async withRefreshLock(_sessionId, fn) {
      return fn();
    },
    async isReachable() {
      return true;
    },
  };
}
