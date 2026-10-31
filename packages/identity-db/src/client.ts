import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildPgPoolConfig } from "./pg/pool.js";
import * as schema from "./schema/index.js";

const { Pool } = pg;

export type IdentityDb = NodePgDatabase<typeof schema>;

export function createIdentityDb(connectionString: string): IdentityDb {
  const pool = new Pool(buildPgPoolConfig(connectionString));
  return drizzle(pool, { schema });
}

export function getIdentityPool(db: IdentityDb): pg.Pool {
  return (db as IdentityDb & { $client: pg.Pool }).$client;
}

/** Drain the underlying pg pool. Call during graceful shutdown. */
export async function closeIdentityDb(db: IdentityDb): Promise<void> {
  await getIdentityPool(db).end();
}
