import {
  PASSKEY_ENROLMENT_GRANT_TTL_SECONDS,
  type PasskeyEnrolmentGrants,
  passkeyGrantKey,
} from "../services/passkey-enrolment-grant.js";

export type GrantRedis = {
  set(key: string, value: string, mode: "EX", ttlSec: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  /** Atomic read-and-delete (Redis 6.2 and later). */
  getdel(key: string): Promise<string | null>;
};

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

  async spend(sessionId: string, subjectId: string): Promise<boolean> {
    return (await this.redis.getdel(passkeyGrantKey(sessionId))) === subjectId;
  }
}
