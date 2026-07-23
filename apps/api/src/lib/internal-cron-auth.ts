import { timingSafeEqual } from "node:crypto";
import type { Env } from "../env.js";

export function timingSafeSecretMatches(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBuf = Buffer.from(actual);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; body: { error: string } };

export function requireCronAuth(
  getHeader: (name: string) => string | undefined,
  env: Env,
): CronAuthResult {
  if (!env.CRON_INTERNAL_SECRET) {
    return { ok: false, status: 503, body: { error: "cron_not_configured" } };
  }
  const secret = getHeader("x-cron-secret");
  if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
    return { ok: false, status: 401, body: { error: "unauthorized" } };
  }
  return { ok: true };
}
