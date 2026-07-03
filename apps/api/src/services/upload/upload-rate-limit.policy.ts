import type { Redis } from "ioredis";

const DAILY_BYTES_LIMIT = 250 * 1024 * 1024;
const DAILY_COUNT_LIMIT = 200;

export class UploadRateLimitPolicy {
  constructor(private readonly redis?: Redis) {}

  async checkQuota(
    userId: string,
    byteSize: number,
  ): Promise<{ ok: true } | { ok: false; resetAt: string }> {
    if (!this.redis) return { ok: false, resetAt: new Date().toISOString() };
    const day = new Date().toISOString().slice(0, 10);
    const bytesKey = `upload:quota:bytes:${userId}:${day}`;
    const countKey = `upload:quota:count:${userId}:${day}`;
    const tx = this.redis.multi();
    tx.incrby(bytesKey, byteSize);
    tx.incr(countKey);
    tx.expire(bytesKey, 36 * 60 * 60);
    tx.expire(countKey, 36 * 60 * 60);
    const result = await tx.exec();
    const totalBytes = Number(result?.[0]?.[1] ?? 0);
    const totalCount = Number(result?.[1]?.[1] ?? 0);
    if (totalBytes > DAILY_BYTES_LIMIT || totalCount > DAILY_COUNT_LIMIT) {
      const resetAt = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
      return { ok: false, resetAt };
    }
    return { ok: true };
  }
}
