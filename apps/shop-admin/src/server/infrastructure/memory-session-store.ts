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
        if (input.sid && record.sid === input.sid) {
          records.delete(sessionId);
        } else if (input.sub && record.subject === input.sub) {
          records.delete(sessionId);
        }
      }
    },
    async claimBackchannelLogoutJti(jti) {
      if (jtiSeen.has(jti)) return false;
      jtiSeen.add(jti);
      return true;
    },
    async withRefreshLock(_sessionId, fn) {
      return fn();
    },
  };
}
