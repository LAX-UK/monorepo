import { sql } from "drizzle-orm";

/** Anything that can run a query: a database, a pool's drizzle client or a transaction. */
type Queryable = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

export type DemoSeedTargetMark = { environment: string; databaseName: string } | null;

/** How an operator marks a test or local database for the demo seeds (owner role, once). */
export const MARK_DEMO_SEED_TARGET_SQL =
  "insert into demo_seed_target (environment, database_name, marked_by) values ('test', current_database(), '<your name>')";

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

/**
 * Whether this database refuses the demo seeds, and why; null when it may receive them. Pure, so
 * the rules are tested without a database: it needs the mark (migration 0398) and the mark must
 * name this very database, so a restored copy under another name is refused too.
 */
export function demoSeedRefusal(mark: DemoSeedTargetMark, currentDatabase: string): string | null {
  if (!mark) {
    return `this database is not marked as a demo seed target (no demo_seed_target row). On a test or local database only, as the owner: ${MARK_DEMO_SEED_TARGET_SQL}`;
  }
  if (mark.environment !== "test" && mark.environment !== "local") {
    return `this database's demo seed mark names an unknown environment (${mark.environment})`;
  }
  if (mark.databaseName !== currentDatabase) {
    return `this database's demo seed mark was written in "${mark.databaseName}", not in "${currentDatabase}" (a restored copy?)`;
  }
  return null;
}

/**
 * Refuses, before anything is written, a database that has not said for itself that it takes the
 * demo seeds. This is the check the address heuristics cannot give: production has no mark, so it
 * is refused even behind an IP address or a renamed cluster. The full demo seeds (Bid and Shop) and the staff queue seeds call it.
 */
export async function assertDemoSeedDatabase(db: Queryable, seed: string): Promise<void> {
  const [identity] = rowsOf(
    await db.execute(
      sql`select current_database() as name, to_regclass('public.demo_seed_target') is not null as has_table`,
    ),
  );
  const currentDatabase = String(identity?.name ?? "");
  if (identity?.has_table !== true) {
    throw new Error(
      `[${seed}] refusing to seed: this database has no demo_seed_target table (migration 0398 not applied)`,
    );
  }
  const [mark] = rowsOf(
    await db.execute(
      sql`select environment, database_name from demo_seed_target where id = true limit 1`,
    ),
  );
  const refusal = demoSeedRefusal(
    mark
      ? { environment: String(mark.environment), databaseName: String(mark.database_name) }
      : null,
    currentDatabase,
  );
  if (refusal) throw new Error(`[${seed}] refusing to seed: ${refusal}`);
}
