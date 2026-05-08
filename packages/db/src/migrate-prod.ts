import pg from "pg";
import { applyApplicationRoleGrants } from "./migrate-roles.js";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import { buildPgConnectionConfig } from "./ssl.js";

async function main() {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) {
    throw new Error("DATABASE_URL_OWNER is required for production migrations");
  }
  const pool = new pg.Pool(buildPgConnectionConfig(url));
  try {
    await runMigrationsPerTransaction(pool);
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
