/**
 * Adds the accounts that automated checks sign in as, to DATABASE_URL. Additive and idempotent,
 * so it is safe on a shared test database. It refuses production and any database without the demo
 * seed mark, and outside a local database it needs SEED_ACCOUNT_PASSWORD (seed-target-guard.ts).
 *
 *   DATABASE_URL=... [SEED_ACCOUNT_PASSWORD=...] pnpm --filter @auction/db db:seed:check-accounts
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../schema/index.js";
import { buildPgConnectionConfig } from "../../ssl.js";
import { runCheckAccountsSeed } from "../check/check-accounts-seed.js";
import {
  assertSeedEnvironment,
  assertSeedTarget,
  seedAccountPassword,
  seedTargetEnvFromProcess,
} from "../shared/seed-target-guard.js";

const SEED = "check-accounts";

async function main() {
  const env = seedTargetEnvFromProcess();
  const url = assertSeedEnvironment(SEED, env);
  const pool = new pg.Pool({
    ...buildPgConnectionConfig(url),
    options: "-c lock_timeout=5s -c statement_timeout=60s",
  });
  try {
    const db = drizzle(pool, { schema });
    const result = await db.transaction(async (tx) => {
      const target = await assertSeedTarget(tx, SEED, env);
      return runCheckAccountsSeed(tx, seedAccountPassword(target, env, SEED));
    });
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
