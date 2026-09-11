import type { EnvelopeCrypto } from "@auction/identity-contracts";
import {
  type IdentityDatabase,
  getIdentityPool,
  hasAuthAtRestPending,
  verifyAuthAtRestStorage,
} from "@auction/identity-db";
import { sql } from "drizzle-orm";
import type { Redis } from "ioredis";

const READINESS_TIMEOUT_MS = 3_000;

export type AuthStartupPreflightInput = {
  db: IdentityDatabase;
  crypto?: EnvelopeCrypto | undefined;
  nodeEnv: "development" | "test" | "production";
};

/** Fail-closed production startup when legacy plaintext auth material remains. */
export async function assertAuthAtRestReady(input: AuthStartupPreflightInput): Promise<void> {
  if (input.nodeEnv !== "production") return;
  if (!input.crypto) throw new Error("auth_at_rest_key_required");
  await verifyAuthAtRestStorage(getIdentityPool(input.db), input.crypto);
}

export type AuthReadinessProbeInput = {
  db: Pick<IdentityDatabase, "execute">;
  redis?: Redis | undefined;
  loadJwks: () => Promise<{ keys: unknown[] }>;
};

async function withTimeout<T>(label: string, timeoutMs: number, run: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function probeAuthReadiness(input: AuthReadinessProbeInput): Promise<void> {
  await withTimeout("database", READINESS_TIMEOUT_MS, async () => {
    await input.db.execute(sql`select 1`);
  });

  if (input.redis) {
    await withTimeout("redis", READINESS_TIMEOUT_MS, async () => {
      const pong = await input.redis?.ping();
      if (pong !== "PONG") throw new Error("redis_unavailable");
    });
  }

  const keySet = await withTimeout("jwks", READINESS_TIMEOUT_MS, () => input.loadJwks());
  if (keySet.keys.length === 0) throw new Error("jwks_empty");
}

export async function reconcileAuthAtRestMetric(
  db: IdentityDatabase,
  setPending: (pending: number) => void,
): Promise<void> {
  const pending = (await hasAuthAtRestPending(getIdentityPool(db))) ? 1 : 0;
  setPending(pending);
}
