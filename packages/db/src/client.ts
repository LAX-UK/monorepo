import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import { buildPgSslConfig } from "./ssl.js";

const { Pool } = pg;

export type Database = NodePgDatabase<typeof schema>;

export function createDb(connectionString: string): Database {
  const pool = new Pool({ connectionString, ssl: buildPgSslConfig() });
  return drizzle(pool, { schema });
}
