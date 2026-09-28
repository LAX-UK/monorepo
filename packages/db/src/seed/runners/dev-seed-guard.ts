import { sql } from "drizzle-orm";
import type { Database } from "../../index.js";
import { user } from "../../schema/index.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function isRemoteOrProtectedSeedTarget(options: {
  databaseUrl: string;
  appEnv?: string;
}): boolean {
  const host = new URL(options.databaseUrl).hostname;
  const isLocal = LOCAL_HOSTS.has(host) || host.endsWith(".local");
  const appEnv = (options.appEnv ?? "").toLowerCase();
  if (appEnv === "test" || appEnv === "production" || appEnv === "prod") {
    return true;
  }
  return !isLocal;
}

export async function assertDevSeedMayRunDestructiveClear(
  db: Database,
  options: { databaseUrl: string; appEnv?: string },
): Promise<void> {
  if (process.env.SEED_ALLOW_DESTRUCTIVE === "1") {
    return;
  }
  if (!isRemoteOrProtectedSeedTarget(options)) {
    return;
  }
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  const userCount = Number(row?.count ?? 0);
  if (userCount > 0) {
    throw new Error(
      `[seed] Refusing destructive clearAll on a non-empty database (${userCount} users). Staging/production seeds are allowed only on an empty database, or set SEED_ALLOW_DESTRUCTIVE=1.`,
    );
  }
}
