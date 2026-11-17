/**
 * Runs the demo top-up against DATABASE_URL. Additive and idempotent, so it is safe on a shared
 * test database. It refuses production and any database without the demo seed mark, and outside a
 * local database it needs SEED_ACCOUNT_PASSWORD for the people it creates (seed-target-guard.ts).
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:seed:demo-topup [--dry-run]
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../schema/index.js";
import { buildPgConnectionConfig } from "../../ssl.js";
import { runDemoTopUp } from "../demo/demo-topup-seed.js";
import {
  type SeedTargetEnv,
  assertSeedEnvironment,
  seedTargetEnvFromProcess,
  withSeedTarget,
} from "../shared/seed-target-guard.js";

type Tx = Parameters<typeof runDemoTopUp>[0];

/** Checks the target and the password, then runs the seed. Nothing is written on a refusal. */
export function seedDemoTopUp(
  tx: Tx,
  env: SeedTargetEnv,
  now: number,
  seed: typeof runDemoTopUp = runDemoTopUp,
): ReturnType<typeof runDemoTopUp> {
  return withSeedTarget(tx, "demo-topup", env, (password) => seed(tx, now, password));
}

/** The production checks every seed shares (seed-target-guard.ts). */
export function assertDemoTopUpTarget(env: SeedTargetEnv): string {
  return assertSeedEnvironment("demo-topup", env);
}

async function main() {
  const env = seedTargetEnvFromProcess();
  const url = assertDemoTopUpTarget(env);
  const pool = new pg.Pool({
    ...buildPgConnectionConfig(url),
    options: "-c lock_timeout=5s -c statement_timeout=60s",
  });
  try {
    // One transaction: either all of the top-up lands or none of it does.
    const db = drizzle(pool, { schema });
    const dryRun = process.argv.includes("--dry-run");
    let result: Awaited<ReturnType<typeof runDemoTopUp>> | undefined;
    await db
      .transaction(async (tx) => {
        result = await seedDemoTopUp(tx, env, Date.now());
        if (dryRun) tx.rollback();
      })
      .catch((error: unknown) => {
        if (!(dryRun && error instanceof Error && error.message.includes("Rollback"))) throw error;
      });
    if (!result) throw new Error("[demo-topup] nothing ran");
    if (dryRun) console.log("[demo-topup] dry run: rolled back");
    console.log(`[demo-topup] created people: ${result.created.join(", ") || "none"}`);
    console.log(`[demo-topup] already there: ${result.existing.join(", ") || "none"}`);
    console.log(`[demo-topup] catalogue: ${JSON.stringify(result.catalogue)}`);
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1]?.endsWith("demo-topup-cli.ts") ||
  process.argv[1]?.endsWith("demo-topup-cli.js")
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
