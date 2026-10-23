/** The slice of ioredis the limiter needs. */
export type SubjectReadRateLimitRedis = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
};

/**
 * Fixed-window budget per subject. By default it fails open when Redis is unavailable, which
 * suits read-only routes: they are authorised, and an outage should not blank the person's
 * security page. Routes that spend money or guard a guessable secret pass `failClosed`.
 */
export function createSubjectReadRateLimiter(options: {
  redis: SubjectReadRateLimitRedis;
  keyPrefix: string;
  windowSec: number;
  max: number;
  failClosed?: boolean;
  onError?: (error: unknown) => void;
}): (subjectId: string) => Promise<number | null> {
  return async (subjectId) => {
    const key = `${options.keyPrefix}:${subjectId}`;
    try {
      const count = await options.redis.incr(key);
      if (count === 1) await options.redis.expire(key, options.windowSec);
      if (count <= options.max) return null;
      const ttl = await options.redis.ttl(key);
      return ttl > 0 ? ttl : options.windowSec;
    } catch (error) {
      options.onError?.(error);
      return options.failClosed ? options.windowSec : null;
    }
  };
}
