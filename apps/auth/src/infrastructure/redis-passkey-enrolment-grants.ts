import {
  PASSKEY_ENROLMENT_GIVE_BACK_FLOOR_MS,
  PASSKEY_ENROLMENT_GRANT_TTL_MS,
  PASSKEY_ENROLMENT_GRANT_TTL_SECONDS,
  type PasskeyEnrolmentGrants,
  type SpentGrant,
  passkeyCreatedKey,
  passkeyGrantKey,
} from "../services/passkey-enrolment-grant.js";

export type GrantRedis = {
  set(key: string, value: string, mode: "EX", ttlSec: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
};

/**
 * Atomic read, end time and delete. Returns {value, expiresAtMs} (Redis clock, epoch ms; 0 when the
 * key has no expiry) or false when absent.
 */
export const SPEND_SCRIPT = `
  local value = redis.call("GET", KEYS[1])
  if not value then return false end
  local pttl = redis.call("PTTL", KEYS[1])
  redis.call("DEL", KEYS[1])
  local expiresAt = 0
  if pttl > 0 then
    local t = redis.call("TIME")
    expiresAt = t[1] * 1000 + math.floor(t[2] / 1000) + pttl
  end
  return {value, expiresAt}
`;

/**
 * Puts a spent grant back until ARGV[2] (epoch ms, Redis clock), at most ARGV[3] ms from now, and
 * only when at least ARGV[4] ms remain. NX: never replaces a grant the session holds again.
 * Returns 1 when put back, 0 otherwise.
 */
export const GIVE_BACK_SCRIPT = `
  local t = redis.call("TIME")
  local now = t[1] * 1000 + math.floor(t[2] / 1000)
  local remaining = math.min(tonumber(ARGV[2]) - now, tonumber(ARGV[3]))
  if remaining < tonumber(ARGV[4]) then return 0 end
  local ok = redis.call("SET", KEYS[1], ARGV[1], "PX", math.floor(remaining), "NX")
  if ok then return 1 end
  return 0
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
    const [value, end] = raw as [unknown, unknown];
    if (value !== subjectId) return null;
    // A grant without an expiry should not exist; it comes back as 0, which gives nothing back.
    const expiresAtMs = Number(end);
    return { expiresAtMs: Number.isFinite(expiresAtMs) && expiresAtMs > 0 ? expiresAtMs : 0 };
  }

  async giveBack(sessionId: string, subjectId: string, expiresAtMs: number): Promise<void> {
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return;
    // The time left is worked out inside Redis at this moment, on the clock that measured the end.
    await this.redis.eval(
      GIVE_BACK_SCRIPT,
      1,
      passkeyGrantKey(sessionId),
      subjectId,
      String(Math.floor(expiresAtMs)),
      String(PASSKEY_ENROLMENT_GRANT_TTL_MS),
      String(PASSKEY_ENROLMENT_GIVE_BACK_FLOOR_MS),
    );
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
