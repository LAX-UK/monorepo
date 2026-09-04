import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import { buildPgConnectionConfig } from "./ssl.js";

const { Pool } = pg;

export type Database = NodePgDatabase<typeof schema>;

function readPoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX;
  if (raw === undefined || raw === "") return 10;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

export function createDb(connectionString: string): Database {
  const pool = new Pool({
    ...buildPgConnectionConfig(connectionString),
    max: readPoolMax(),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
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
