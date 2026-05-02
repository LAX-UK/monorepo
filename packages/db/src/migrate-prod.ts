import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { applyApplicationRoleGrants } from "./migrate-roles.js";
import * as schema from "./schema/index.js";
import { buildPgSslConfig } from "./ssl.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) {
    throw new Error("DATABASE_URL_OWNER is required for production migrations");
  }
  const pool = new pg.Pool({ connectionString: url, ssl: buildPgSslConfig() });
  try {
    const db = drizzle(pool, { schema });
    const migrationsFolder = path.join(__dirname, "../drizzle");
    await migrate(db, { migrationsFolder });
    await applyApplicationRoleGrants(url);
  } finally {
    await pool.end();
  }
  console.log("Production migrations and role grants applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
