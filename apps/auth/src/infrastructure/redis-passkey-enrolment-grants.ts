import {
  PASSKEY_ENROLMENT_GIVE_BACK_FLOOR_MS,
  PASSKEY_ENROLMENT_GRANT_TTL_SECONDS,
  type PasskeyEnrolmentGrants,
  type SpentGrant,
  passkeyCreatedKey,
  passkeyGrantKey,
} from "../services/passkey-enrolment-grant.js";

export type GrantRedis = {
  set(key: string, value: string, mode: "EX", ttlSec: number): Promise<unknown>;
  set(key: string, value: string, mode: "PX", ttlMs: number, flag: "NX"): Promise<unknown>;
  get(key: string): Promise<string | null>;
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
};

/** Atomic read, remaining lifetime and delete: returns {value, pttl} or false when absent. */
const SPEND_SCRIPT = `
  local value = redis.call("GET", KEYS[1])
  if not value then return false end
  local pttl = redis.call("PTTL", KEYS[1])
  redis.call("DEL", KEYS[1])
  return {value, pttl}
`;

/** Grants in Redis: one per session, holding the subject it was given to, gone after five minutes. */
export class RedisPasskeyEnrolmentGrants implements PasskeyEnrolmentGrants {
  constructor(private readonly redis: GrantRedis) {}

  async grant(sessionId: string, subjectId: string): Promise<void> {
    await this.redis.set(
      passkeyGrantKey(sessionId),
      subjectId,
      "EX",
      PASSKEY_ENROLMENT_GRANT_TTL_SECONDS,
    );
  }

  async holds(sessionId: string, subjectId: string): Promise<boolean> {
    return (await this.redis.get(passkeyGrantKey(sessionId))) === subjectId;
  }

  async spend(sessionId: string, subjectId: string): Promise<SpentGrant | null> {
    const raw = await this.redis.eval(SPEND_SCRIPT, 1, passkeyGrantKey(sessionId));
    if (!Array.isArray(raw)) return null;
    const [value, pttl] = raw as [unknown, unknown];
    if (value !== subjectId) return null;
    const ttl = Number(pttl);
    // A grant with no expiry should not exist; treat it as having the full lifetime at most.
    const max = PASSKEY_ENROLMENT_GRANT_TTL_SECONDS * 1000;
    const remainingMs = Number.isFinite(ttl) && ttl > 0 ? Math.min(ttl, max) : 0;
    return { remainingMs };
  }

  async giveBack(sessionId: string, subjectId: string, remainingMs: number): Promise<void> {
    const ms = Math.min(Math.floor(remainingMs), PASSKEY_ENROLMENT_GRANT_TTL_SECONDS * 1000);
    if (!Number.isFinite(ms) || ms < PASSKEY_ENROLMENT_GIVE_BACK_FLOOR_MS) return;
    // NX: never replaces (and so never lengthens) a permission the session holds again.
    await this.redis.set(passkeyGrantKey(sessionId), subjectId, "PX", ms, "NX");
  }

  async noteCreated(sessionId: string, subjectId: string, passkeyId: string): Promise<void> {
    await this.redis.set(
      passkeyCreatedKey(sessionId),
      JSON.stringify([subjectId, passkeyId]),
      "EX",
      PASSKEY_ENROLMENT_GRANT_TTL_SECONDS,
    );
  }

  async createdPasskey(sessionId: string, subjectId: string): Promise<string | null> {
    const raw = await this.redis.get(passkeyCreatedKey(sessionId));
    if (!raw) return null;
    try {
      const [owner, passkeyId] = JSON.parse(raw) as [unknown, unknown];
      return owner === subjectId && typeof passkeyId === "string" ? passkeyId : null;
    } catch {
      return null;
    }
  }
}
