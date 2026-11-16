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
    return `this database is not marked as a demo seed target (no demo_seed_target row). A local database: run \`pnpm db:seed\` (it marks a fresh local database first), or for an existing one \`pnpm --filter @auction/db db:seed:mark-demo-target local <your name> --existing-local-database\`. A test database, as the owner: ${MARK_DEMO_SEED_TARGET_SQL}`;
  }
  if (mark.environment !== "test" && mark.environment !== "local") {
    return `this database's demo seed mark names an unknown environment (${mark.environment})`;
  }
  if (mark.databaseName !== currentDatabase) {
    return `this database's demo seed mark was written in "${mark.databaseName}", not in "${currentDatabase}" (a restored copy?)`;
  }
  return null;
}

/** What a database says about itself: its name, whether it has the mark table, and the mark. */
export type DemoSeedTargetState = {
  currentDatabase: string;
  hasTable: boolean;
  mark: DemoSeedTargetMark;
};

export async function readDemoSeedTarget(db: Queryable): Promise<DemoSeedTargetState> {
  const [identity] = rowsOf(
    await db.execute(
      sql`select current_database() as name, to_regclass('public.demo_seed_target') is not null as has_table`,
    ),
  );
  const currentDatabase = String(identity?.name ?? "");
  if (identity?.has_table !== true) return { currentDatabase, hasTable: false, mark: null };
  const [mark] = rowsOf(
    await db.execute(
      sql`select environment, database_name from demo_seed_target where id = true limit 1`,
    ),
  );
  return {
    currentDatabase,
    hasTable: true,
    mark: mark
      ? { environment: String(mark.environment), databaseName: String(mark.database_name) }
      : null,
  };
}

/**
 * Refuses, before anything is written, a database that has not said for itself that it takes the
 * demo seeds. This is the check the address heuristics cannot give: production has no mark, so it
 * is refused even behind an IP address or a renamed cluster. Every seed that writes accounts or
 * staff grants reaches it through `assertSeedTarget` (seed-target-guard.ts). Returns the mark.
 */
export async function assertDemoSeedDatabase(
  db: Queryable,
  seed: string,
): Promise<NonNullable<DemoSeedTargetMark>> {
  const { currentDatabase, hasTable, mark } = await readDemoSeedTarget(db);
  if (!hasTable) {
    throw new Error(
      `[${seed}] refusing to seed: this database has no demo_seed_target table (migration 0398 not applied)`,
    );
  }
  const refusal = demoSeedRefusal(mark, currentDatabase);
  if (refusal || !mark) throw new Error(`[${seed}] refusing to seed: ${refusal}`);
  return mark;
}
