import type { Redis } from "ioredis";

/**
 * The sorted-set commands the auth rate limiters use. Keeping the surface this
 * small is what lets an in-process store stand in for Redis during an outage.
 */
export type SlidingWindowPipeline = {
  zadd(key: string, score: number, member: string): SlidingWindowPipeline;
  zremrangebyscore(key: string, min: number, max: number): SlidingWindowPipeline;
  expire(key: string, seconds: number): SlidingWindowPipeline;
  zcard(key: string): SlidingWindowPipeline;
  exec(): Promise<[Error | null, unknown][] | null>;
};

export type SlidingWindowStore = {
  multi(): SlidingWindowPipeline;
  zrange(key: string, start: number, stop: number, withScores: "WITHSCORES"): Promise<string[]>;
  zrem(key: string, member: string): Promise<number>;
};

type Entry = { score: number; member: string };
type Command =
  | { op: "zadd"; key: string; score: number; member: string }
  | { op: "zremrangebyscore"; key: string; min: number; max: number }
  | { op: "expire"; key: string; seconds: number }
  | { op: "zcard"; key: string };

const SWEEP_INTERVAL_MS = 60_000;

/** Per-process sliding windows with the same semantics as the Redis sorted sets. */
export function createInProcessSlidingWindowStore(
  now: () => number = Date.now,
): SlidingWindowStore {
  const sets = new Map<string, { entries: Entry[]; expiresAt: number }>();
  let lastSweep = now();

  function sweep(): void {
    const t = now();
    if (t - lastSweep < SWEEP_INTERVAL_MS) return;
    lastSweep = t;
    for (const [key, set] of sets) {
      if (set.expiresAt <= t || set.entries.length === 0) sets.delete(key);
    }
  }

  function live(key: string) {
    const set = sets.get(key);
    if (set && set.expiresAt <= now()) {
      sets.delete(key);
      return undefined;
    }
    return set;
  }

  function run(command: Command): unknown {
    switch (command.op) {
      case "zadd": {
        const set = live(command.key) ?? { entries: [], expiresAt: Number.POSITIVE_INFINITY };
        set.entries.push({ score: command.score, member: command.member });
        sets.set(command.key, set);
        return 1;
      }
      case "zremrangebyscore": {
        const set = live(command.key);
        if (!set) return 0;
        const before = set.entries.length;
        set.entries = set.entries.filter((e) => e.score < command.min || e.score > command.max);
        return before - set.entries.length;
      }
      case "expire": {
        const set = live(command.key);
        if (!set) return 0;
        set.expiresAt = now() + command.seconds * 1000;
        return 1;
      }
      case "zcard":
        return live(command.key)?.entries.length ?? 0;
    }
  }

  return {
    multi() {
      const commands: Command[] = [];
      const pipeline: SlidingWindowPipeline = {
        zadd(key, score, member) {
          commands.push({ op: "zadd", key, score, member });
          return pipeline;
        },
        zremrangebyscore(key, min, max) {
          commands.push({ op: "zremrangebyscore", key, min, max });
          return pipeline;
        },
        expire(key, seconds) {
          commands.push({ op: "expire", key, seconds });
          return pipeline;
        },
        zcard(key) {
          commands.push({ op: "zcard", key });
          return pipeline;
        },
        async exec() {
          sweep();
          return commands.map((command) => [null, run(command)] as [Error | null, unknown]);
        },
      };
      return pipeline;
    },
    async zrange(key, start, stop) {
      const entries = [...(live(key)?.entries ?? [])].sort((a, b) => a.score - b.score);
      const end = stop < 0 ? entries.length + stop + 1 : stop + 1;
      return entries.slice(start, end).flatMap((e) => [e.member, String(e.score)]);
    },
    async zrem(key, member) {
      const set = live(key);
      if (!set) return 0;
      const before = set.entries.length;
      set.entries = set.entries.filter((e) => e.member !== member);
      return before - set.entries.length;
    },
  };
}

export type RateLimitFallbackLogger = {
  warn(context: Record<string, unknown>, message: string): void;
};

const OUTAGE_LOG_INTERVAL_MS = 60_000;
/** After a Redis failure, skip Redis briefly so a dead connection does not add latency to every request. */
const REDIS_RETRY_AFTER_MS = 5_000;

/**
 * Redis-first sliding-window store that falls back to per-process windows when
 * Redis errors. Credential endpoints must never run unlimited, and a Redis
 * outage must not turn every `/api/auth/*` call into a 500. Limits are
 * enforced per instance while degraded, so the effective ceiling across N
 * instances is up to N times looser until Redis returns.
 */
export function createResilientSlidingWindowStore(
  redis: Redis,
  log: RateLimitFallbackLogger,
  now: () => number = Date.now,
): SlidingWindowStore {
  const fallback = createInProcessSlidingWindowStore(now);
  let skipRedisUntil = 0;
  let lastLoggedAt = Number.NEGATIVE_INFINITY;

  function noteFailure(error: unknown): void {
    const t = now();
    skipRedisUntil = t + REDIS_RETRY_AFTER_MS;
    if (t - lastLoggedAt < OUTAGE_LOG_INTERVAL_MS) return;
    lastLoggedAt = t;
    log.warn(
      { errorName: error instanceof Error ? error.name : "unknown" },
      "rate_limit_redis_unavailable_using_in_process_fallback",
    );
  }

  async function withFallback<T>(viaRedis: () => Promise<T>, viaFallback: () => Promise<T>) {
    if (now() < skipRedisUntil) return viaFallback();
    try {
      return await viaRedis();
    } catch (error) {
      noteFailure(error);
      return viaFallback();
    }
  }

  return {
    multi() {
      const replay: Array<(pipeline: SlidingWindowPipeline) => void> = [];
      const pipeline: SlidingWindowPipeline = {
        zadd(key, score, member) {
          replay.push((p) => p.zadd(key, score, member));
          return pipeline;
        },
        zremrangebyscore(key, min, max) {
          replay.push((p) => p.zremrangebyscore(key, min, max));
          return pipeline;
        },
        expire(key, seconds) {
          replay.push((p) => p.expire(key, seconds));
          return pipeline;
        },
        zcard(key) {
          replay.push((p) => p.zcard(key));
          return pipeline;
        },
        exec: () =>
          withFallback(
            async () => {
              const target = redis.multi() as unknown as SlidingWindowPipeline;
              for (const apply of replay) apply(target);
              const results = await target.exec();
              // ioredis reports a command-level failure inside the result rows instead of rejecting.
              const failed = results?.find(([error]) => error);
              if (!results || failed)
                throw failed?.[0] ?? new Error("Redis pipeline returned no result");
              return results;
            },
            () => {
              const target = fallback.multi();
              for (const apply of replay) apply(target);
              return target.exec();
            },
          ),
      };
      return pipeline;
    },
    zrange: (key, start, stop, withScores) =>
      withFallback(
        () => redis.zrange(key, start, stop, withScores),
        () => fallback.zrange(key, start, stop, withScores),
      ),
    zrem: (key, member) =>
      withFallback(
        () => redis.zrem(key, member),
        () => fallback.zrem(key, member),
      ),
  };
}
