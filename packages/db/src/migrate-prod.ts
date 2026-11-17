import pg from "pg";
import { applyApplicationRoleGrants } from "./migrate-roles.js";
import {
  readLastAppliedFolderMillis,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import {
  ONLINE_INDEX_APPLICATION_NAME,
  runPendingOnlineIndexBuilds,
} from "./online-index/index.js";
import { resolveProductionMigrationThrough } from "./production-migration-ceiling.js";
import { buildPgConnectionConfig, buildPgPoolConfig } from "./ssl.js";

async function main() {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) {
    throw new Error("DATABASE_URL_OWNER is required for production migrations");
  }
  const pool = new pg.Pool(buildPgPoolConfig(url));
  try {
    const lastApplied = await readLastAppliedFolderMillis(pool);
    const ceiling = resolveProductionMigrationThrough(process.env, lastApplied);
    console.log(
      ceiling.folderMillis === null
        ? `Production migration ceiling: ${ceiling.tag} (every journal migration).`
        : `Production migration ceiling: ${ceiling.tag}.`,
    );
    // Online index step: build declared indexes (drizzle/online/<tag>.sql) with CREATE INDEX
    // CONCURRENTLY on an autocommit connection, outside any transaction, before the runner. The
    // migrations' own CREATE INDEX IF NOT EXISTS then adopts them. A failure stops the deploy
    // here, before any migration runs. See docs/runbooks/online-index-builds.md.
    const onlineClient = new pg.Client({
      ...buildPgConnectionConfig(url),
      application_name: ONLINE_INDEX_APPLICATION_NAME,
    });
    await onlineClient.connect();
    try {
      await runPendingOnlineIndexBuilds(onlineClient, ceiling.folderMillis);
    } finally {
      await onlineClient.end();
    }
    await runMigrationsPerTransactionThrough(pool, ceiling.folderMillis ?? undefined);
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
