import { sql } from "drizzle-orm";
import type { Database } from "../../index.js";
import { user } from "../../schema/index.js";
import { isLocalSeedAddress } from "../shared/seed-target-guard.js";

/** Anything but a local database: a remote host, or a test or production environment. */
export function isRemoteOrProtectedSeedTarget(options: {
  databaseUrl: string;
  appEnv?: string;
}): boolean {
  return !isLocalSeedAddress(options);
}

/**
 * The dev seed wipes the tables it loads. The demo seed mark has already been checked
 * (`assertSeedTarget`), so this is a second check on top of it: a marked remote database is wiped
 * only while it has no users, or when an operator sets SEED_ALLOW_DESTRUCTIVE=1 on purpose.
 */
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
