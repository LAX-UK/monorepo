/**
 * Runs the full demo seed against DATABASE_URL. Additive and idempotent, so it is safe on a shared
 * test database. It refuses production and any database without the demo seed mark, and outside a
 * local database it needs SEED_ACCOUNT_PASSWORD for the people it creates (seed-target-guard.ts).
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:seed:demo-full [--dry-run]
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../schema/index.js";
import { buildPgConnectionConfig } from "../../ssl.js";
import { runDemoFull } from "../demo/demo-full-seed.js";
import {
  type SeedTargetEnv,
  assertSeedEnvironment,
  seedTargetEnvFromProcess,
  withSeedTarget,
} from "../shared/seed-target-guard.js";

type Tx = Parameters<typeof runDemoFull>[0];

/** Checks the target and the password, then runs the seed. Nothing is written on a refusal. */
export function seedDemoFull(
  tx: Tx,
  env: SeedTargetEnv,
  now: number,
  seed: typeof runDemoFull = runDemoFull,
): ReturnType<typeof runDemoFull> {
  return withSeedTarget(tx, "demo-full", env, (password) => seed(tx, now, password));
}

/** The production checks every seed shares (seed-target-guard.ts). */
export function assertDemoFullTarget(env: SeedTargetEnv): string {
  return assertSeedEnvironment("demo-full", env);
}

async function main() {
  const env = seedTargetEnvFromProcess();
  const url = assertDemoFullTarget(env);
  const pool = new pg.Pool({
    ...buildPgConnectionConfig(url),
    options: "-c lock_timeout=5s -c statement_timeout=60s",
  });
  try {
    // One transaction: either all of the top-up lands or none of it does.
    const db = drizzle(pool, { schema });
    const dryRun = process.argv.includes("--dry-run");
    let result: Awaited<ReturnType<typeof runDemoFull>> | undefined;
    await db
      .transaction(async (tx) => {
        result = await seedDemoFull(tx, env, Date.now());
        if (dryRun) tx.rollback();
      })
      .catch((error: unknown) => {
        if (!(dryRun && error instanceof Error && error.message.includes("Rollback"))) throw error;
      });
    if (!result) throw new Error("[demo-full] nothing ran");
    if (dryRun) console.log("[demo-full] dry run: rolled back");
    console.log(`[demo-full] created people: ${result.topUp.created.join(", ") || "none"}`);
    console.log(`[demo-full] top-up catalogue: ${JSON.stringify(result.topUp.catalogue)}`);
    console.log(`[demo-full] staff queues filled: ${result.queues.join(", ")}`);
    console.log(
      `[demo-full] full catalogue: ${result.sales} sales, ${result.lots} lots, ${result.bids} bids, ${result.departments} departments`,
    );
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1]?.endsWith("demo-full-cli.ts") ||
  process.argv[1]?.endsWith("demo-full-cli.js")
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
