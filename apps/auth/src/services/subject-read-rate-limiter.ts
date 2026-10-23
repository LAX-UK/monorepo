/** The slice of ioredis the limiter needs. */
export type SubjectReadRateLimitRedis = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
};

/**
 * Fixed-window budget per subject for read-only issuer routes. It fails open when Redis is
 * unavailable: the route is authorised and read-only, so an outage should not blank the
 * person's security page.
 */
export function createSubjectReadRateLimiter(options: {
  redis: SubjectReadRateLimitRedis;
  keyPrefix: string;
  windowSec: number;
  max: number;
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
      return null;
    }
  };
}
