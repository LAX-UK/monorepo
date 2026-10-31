import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import { buildPgPoolConfig } from "./ssl.js";

const { Pool } = pg;

export type Database = NodePgDatabase<typeof schema>;

export function createDb(connectionString: string): Database {
  const pool = new Pool(buildPgPoolConfig(connectionString));
  return createDbFromPool(pool);
}

export function createDbFromPool(pool: pg.Pool): Database {
  return drizzle(pool, { schema });
}

/** Drain the underlying pg pool. Call during graceful shutdown. */
export async function closeDb(db: Database): Promise<void> {
  const pool = (db as Database & { $client: pg.Pool }).$client;
  await pool.end();
}
