import { randomUUID } from "node:crypto";
import type {
  BudgetDecision,
  CallBudget,
  RateWindow,
  RefreshLock,
} from "@auction/accounting-zoho-books";
import type { Redis } from "ioredis";

const PREFIX = "zoho_books:";

/** A day's count is kept a little past the day so a late call near midnight is still counted. */
const BUDGET_TTL_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Takes one call if fewer than the limit were taken today. Atomic, so replicas never both take
 * the last call. Returns { allowed (1|0), used }.
 */
const CONSUME_BUDGET = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if used >= limit then return {0, used} end
used = redis.call('INCR', KEYS[1])
if used == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return {1, used}
`;

/**
 * A sliding window of request times per organisation, read on Redis's own clock so every replica
 * sees the same window. Returns 0 when a slot was taken, otherwise milliseconds until one frees.
 */
const TAKE_RATE_SLOT = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZCARD', KEYS[1]) < limit then
  redis.call('ZADD', KEYS[1], now, ARGV[3])
  redis.call('PEXPIRE', KEYS[1], window)
  return 0
end
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local wait = tonumber(oldest[2]) + window - now
if wait < 1 then wait = 1 end
return wait
`;

/** Deletes the lock only if this holder still owns it (a lease that expired may belong to another). */
const RELEASE_LOCK = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

/** The Zoho Books daily call budget, one count per organisation per UTC day, shared by every replica. */
export class RedisCallBudget implements CallBudget {
  constructor(
    private readonly redis: Redis,
    private readonly limit: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Rejects when Redis cannot be reached; the client then sends nothing. */
  async consume(organizationId: string): Promise<BudgetDecision> {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const [allowed, used] = (await this.redis.eval(
      CONSUME_BUDGET,
      1,
      `${PREFIX}budget:${organizationId}:${day}`,
      String(this.limit),
      String(BUDGET_TTL_MS),
    )) as [number, number];
    return { allowed: allowed === 1, used, limit: this.limit };
  }
}

/** The Zoho Books per-organisation request window, shared by every replica. */
export class RedisRateWindow implements RateWindow {
  constructor(private readonly redis: Redis) {}

  /** Rejects when Redis cannot be reached; the client then backs off and sends nothing. */
  async take(organizationId: string, limit: number, windowMs: number): Promise<number> {
    const wait = await this.redis.eval(
      TAKE_RATE_SLOT,
      1,
      `${PREFIX}rate:${organizationId}`,
      String(limit),
      String(windowMs),
      randomUUID(),
    );
    return Number(wait);
  }
}

export interface RedisRefreshLockOptions {
  /**
   * How long the lock is held at most if its holder dies. Longer than one refresh takes (the
   * client's request timeout plus the store's reads and writes).
   */
  readonly leaseMs: number;
  /** How long a caller waits for another replica's refresh before giving up. */
  readonly maxWaitMs: number;
  readonly pollMs?: number;
}

/** A lease per organisation around the Zoho Books token refresh, shared by every replica. */
export class RedisRefreshLock implements RefreshLock {
  constructor(
    private readonly redis: Redis,
    private readonly options: RedisRefreshLockOptions,
  ) {}

  /** Rejects without running `work` when Redis cannot be reached or the lock is not free in time. */
  async withLock<T>(organizationId: string, work: () => Promise<T>): Promise<T> {
    const key = `${PREFIX}refresh_lock:${organizationId}`;
    const owner = randomUUID();
    const deadline = Date.now() + this.options.maxWaitMs;
    for (;;) {
      const taken = await this.redis.set(key, owner, "PX", this.options.leaseMs, "NX");
      if (taken === "OK") break;
      if (Date.now() >= deadline) throw new Error("zoho_books_refresh_lock_timeout");
      await new Promise((resolve) => setTimeout(resolve, this.options.pollMs ?? 100));
    }
    try {
      return await work();
    } finally {
      // A failed release leaves the lease to expire; it never hides the outcome of `work`.
      await this.redis.eval(RELEASE_LOCK, 1, key, owner).catch(() => undefined);
    }
  }
}

/**
 * The shared limits a Zoho Books client in a worker replica is built with:
 * `new ZohoBooksClient({ ...deps, ...redisZohoBooksLimits(redis, config) })`.
 */
export function redisZohoBooksLimits(
  redis: Redis,
  config: { readonly dailyCallBudget: number; readonly requestTimeoutMs: number },
): { budget: CallBudget; rateWindow: RateWindow; refreshLock: RefreshLock } {
  const leaseMs = config.requestTimeoutMs + 10_000;
  return {
    budget: new RedisCallBudget(redis, config.dailyCallBudget),
    rateWindow: new RedisRateWindow(redis),
    refreshLock: new RedisRefreshLock(redis, { leaseMs, maxWaitMs: leaseMs }),
  };
}
