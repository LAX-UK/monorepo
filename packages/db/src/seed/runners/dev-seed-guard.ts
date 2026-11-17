import { sql } from "drizzle-orm";
import type { Database } from "../../index.js";
import { user } from "../../schema/index.js";

/**
 * Whether the dev seed must check that the database has no users before it wipes it. Only a
 * hermetic database (marked "local" and at a local address, see `assertSeedTarget`) skips the
 * check; an address alone never does, because a loopback address can be a tunnel to a remote
 * database. SEED_ALLOW_DESTRUCTIVE=1 is an operator's explicit choice, and the demo seed mark
 * has already been checked by then.
 */
export function devSeedNeedsEmptyDatabase(options: {
  hermetic: boolean;
  allowDestructive: string | undefined;
}): boolean {
  if (options.allowDestructive === "1") return false;
  return !options.hermetic;
}

/**
 * The dev seed wipes the tables it loads. The demo seed mark has already been checked
 * (`assertSeedTarget`), so this is a second check on top of it: a database that is not hermetic is
 * wiped only while it has no users, or when an operator sets SEED_ALLOW_DESTRUCTIVE=1 on purpose.
 */
export async function assertDevSeedMayRunDestructiveClear(
  db: Database,
  options: { hermetic: boolean },
): Promise<void> {
  if (
    !devSeedNeedsEmptyDatabase({
      hermetic: options.hermetic,
      allowDestructive: process.env.SEED_ALLOW_DESTRUCTIVE,
    })
  ) {
    return;
  }
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  const userCount = Number(row?.count ?? 0);
  if (userCount > 0) {
    throw new Error(
      `[seed] Refusing destructive clearAll on a non-empty database (${userCount} users). A database that is not a hermetic local one is seeded only while it is empty, or set SEED_ALLOW_DESTRUCTIVE=1.`,
    );
  }
}
