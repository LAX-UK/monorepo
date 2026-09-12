import { createHash } from "node:crypto";

const FAILURE_WINDOW_SEC = 60;
const FAILURE_MAX = 10;

export type MachineCredentialRateLimitRedis = {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<unknown>;
};

export type MachineCredentialRateLimitDecision =
  | { limited: false }
  | { limited: true; retryAfterSec: number };

function failureKey(clientId: string): string {
  const digest = createHash("sha256").update(clientId).digest("hex");
  return `rl:auth-issuer:machine-credential:${digest}`;
}

export class MachineCredentialRateLimiter {
  constructor(private readonly redis: MachineCredentialRateLimitRedis) {}

  async check(clientId: string): Promise<MachineCredentialRateLimitDecision> {
    const key = failureKey(clientId);
    const count = Number((await this.redis.get(key)) ?? 0);
    if (count < FAILURE_MAX) return { limited: false };
    const ttl = await this.redis.ttl(key);
    return {
      limited: true,
      retryAfterSec: ttl > 0 ? ttl : FAILURE_WINDOW_SEC,
    };
  }

  async recordFailure(clientId: string): Promise<MachineCredentialRateLimitDecision> {
    const key = failureKey(clientId);
    const count = await this.redis.incr(key);
    if (count === 1) {
      try {
        await this.redis.expire(key, FAILURE_WINDOW_SEC);
      } catch (error) {
        await this.redis.del(key).catch(() => undefined);
        throw error;
      }
    }
    if (count <= FAILURE_MAX) return { limited: false };
    const ttl = await this.redis.ttl(key);
    return {
      limited: true,
      retryAfterSec: ttl > 0 ? ttl : FAILURE_WINDOW_SEC,
    };
  }

  async reset(clientId: string): Promise<void> {
    await this.redis.del(failureKey(clientId));
  }
}
