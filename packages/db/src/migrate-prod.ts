import pg from "pg";
import { applyApplicationRoleGrants } from "./migrate-roles.js";
import {
  readLastAppliedFolderMillis,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import { resolveProductionMigrationThrough } from "./production-migration-ceiling.js";
import { buildPgConnectionConfig } from "./ssl.js";

async function main() {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) {
    throw new Error("DATABASE_URL_OWNER is required for production migrations");
  }
  const pool = new pg.Pool(buildPgConnectionConfig(url));
  try {
    const lastApplied = await readLastAppliedFolderMillis(pool);
    const ceiling = resolveProductionMigrationThrough(process.env, lastApplied);
    console.log(`Production migration ceiling: ${ceiling.tag}.`);
    await runMigrationsPerTransactionThrough(pool, ceiling.folderMillis);
    // Re-applies `api_app` / `auth_app` / `worker_app` table + column grants (see migrate-roles.ts).
    // DigitalOcean App Platform PRE_DEPLOY runs this script on each release.
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
