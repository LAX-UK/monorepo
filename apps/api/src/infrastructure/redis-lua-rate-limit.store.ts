import type { Redis } from "ioredis";
import type { IRateLimitStore, RateLimitResult } from "../services/interfaces/rate-limit-store.js";

const FIXED_WINDOW_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
if current > tonumber(ARGV[1]) then
  local ttl = redis.call('TTL', KEYS[1])
  return {0, ttl}
end
return {1, tonumber(ARGV[1]) - current}
`;

export class RedisLuaRateLimitStore implements IRateLimitStore {
  private scriptSha: string | null = null;

  constructor(private readonly redis: Redis) {}

  private async ensureScriptLoaded(): Promise<string> {
    if (this.scriptSha) return this.scriptSha;
    this.scriptSha = (await this.redis.script("LOAD", FIXED_WINDOW_LUA)) as string;
    return this.scriptSha;
  }

  async increment(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
    const sha = await this.ensureScriptLoaded();
    try {
      return this.parseResult(
        await this.redis.evalsha(sha, 1, key, String(limit), String(windowSec)),
      );
    } catch (err) {
      if (!this.isNoScriptError(err)) throw err;
      this.scriptSha = null;
      const reloaded = await this.ensureScriptLoaded();
      return this.parseResult(
        await this.redis.evalsha(reloaded, 1, key, String(limit), String(windowSec)),
      );
    }
  }

  private parseResult(raw: unknown): RateLimitResult {
    const tuple = raw as [number, number];
    const allowedFlag = Number(tuple[0]);
    const second = Number(tuple[1]);
    if (allowedFlag === 0) {
      return { allowed: false, remaining: 0, retryAfterSec: Math.max(second, 1) };
    }
    return { allowed: true, remaining: Math.max(second, 0) };
  }

  private isNoScriptError(err: unknown): boolean {
    return err instanceof Error && err.message.includes("NOSCRIPT");
  }
}
