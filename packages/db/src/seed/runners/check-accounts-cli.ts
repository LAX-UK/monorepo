/**
 * Adds the accounts that automated checks sign in as, to DATABASE_URL. Additive and idempotent,
 * so it is safe on a shared test database; it refuses production.
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:seed:check-accounts
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../schema/index.js";
import { buildPgConnectionConfig } from "../../ssl.js";
import { runCheckAccountsSeed } from "../check/check-accounts-seed.js";
import { assertDemoTopUpTarget } from "./demo-topup-cli.js";

async function main() {
  const url = assertDemoTopUpTarget({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    appEnv: process.env.APP_ENV,
  });
  const pool = new pg.Pool({
    ...buildPgConnectionConfig(url),
    options: "-c lock_timeout=5s -c statement_timeout=60s",
  });
  try {
    const db = drizzle(pool, { schema });
    const result = await db.transaction((tx) => runCheckAccountsSeed(tx));
    console.log(`[check-accounts] created: ${result.created.join(", ") || "none"}`);
    console.log(`[check-accounts] already there: ${result.existing.join(", ") || "none"}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
