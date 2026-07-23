import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";

/** Minimal compare-and-renew / compare-and-delete lease (tokenized). */
export async function acquireRenewableLease(
  redis: Redis,
  key: string,
  ttlMs: number,
): Promise<{ token: string } | null> {
  const token = randomUUID();
  const ok = await redis.set(key, token, "PX", ttlMs, "NX");
  return ok === "OK" ? { token } : null;
}

export async function renewRenewableLease(
  redis: Redis,
  key: string,
  token: string,
  ttlMs: number,
): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("pexpire", KEYS[1], ARGV[2])
    else
      return 0
    end`;
  const result = await redis.eval(script, 1, key, token, String(ttlMs));
  return result === 1;
}

export async function releaseRenewableLease(
  redis: Redis,
  key: string,
  token: string,
): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end`;
  const result = await redis.eval(script, 1, key, token);
  return result === 1;
}
