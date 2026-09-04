import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { buildPgConnectionConfig } from "./pg/ssl.js";
import * as schema from "./schema/index.js";

const { Pool } = pg;

export type IdentityDb = NodePgDatabase<typeof schema>;

function readPoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX;
  if (raw === undefined || raw === "") return 10;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

export function createIdentityDb(connectionString: string): IdentityDb {
  const pool = new Pool({
    ...buildPgConnectionConfig(connectionString),
    max: readPoolMax(),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return drizzle(pool, { schema });
}

export function getIdentityPool(db: IdentityDb): pg.Pool {
  return (db as IdentityDb & { $client: pg.Pool }).$client;
}

/** Drain the underlying pg pool. Call during graceful shutdown. */
export async function closeIdentityDb(db: IdentityDb): Promise<void> {
  await getIdentityPool(db).end();
}
