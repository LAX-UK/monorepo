import pg from "pg";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import { onlineIndexStepOptedIn, runOnlineIndexPreStep } from "./online-index/index.js";
import { buildPgPoolConfig } from "./ssl.js";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  // The test environment deploy runs this script (full journal, see
  // scripts/ci/verify-staging-migrate-contract.mjs) with ONLINE_INDEX_STEP=1, so it builds the
  // declared indexes concurrently first, exactly as migrate-prod.ts does. Local and CI leave it
  // unset and migrate as before. See docs/runbooks/online-index-builds.md.
  if (onlineIndexStepOptedIn(process.env)) {
    await runOnlineIndexPreStep(url, null);
  }
  const pool = new pg.Pool(buildPgPoolConfig(url));
  try {
    await runMigrationsPerTransaction(pool);
  } finally {
    await pool.end();
  }
  console.log("Migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
