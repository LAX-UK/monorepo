import type { SessionStore, StaffSessionRecord } from "../ports/session-store";

export function createMemorySessionStore(): SessionStore {
  const records = new Map<string, StaffSessionRecord>();
  const jtiSeen = new Set<string>();

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
    async withRefreshLock(_sessionId, fn) {
      return fn();
    },
    async isReachable() {
      return true;
    },
  };
}
