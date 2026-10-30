/**
 * Runs the demo top-up against DATABASE_URL. Additive and idempotent, so it is safe on a shared
 * test database; it refuses production.
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:seed:demo-topup [--dry-run]
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../schema/index.js";
import { buildPgConnectionConfig } from "../../ssl.js";
import { runDemoTopUp } from "../demo/demo-topup-seed.js";

export function assertDemoTopUpTarget(env: {
  databaseUrl: string | undefined;
  nodeEnv?: string | undefined;
  appEnv?: string | undefined;
}): string {
  if (!env.databaseUrl) throw new Error("[demo-topup] DATABASE_URL is required");
  const production = (value: string | undefined) =>
    ["production", "prod"].includes((value ?? "").toLowerCase());
  if (production(env.nodeEnv) || production(env.appEnv)) {
    throw new Error("[demo-topup] refusing to run in production");
  }
  if (/prod/i.test(new URL(env.databaseUrl).hostname)) {
    throw new Error("[demo-topup] refusing a production database host");
  }
  return env.databaseUrl;
}

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
    // One transaction: either all of the top-up lands or none of it does.
    const db = drizzle(pool, { schema });
    const dryRun = process.argv.includes("--dry-run");
    let result: Awaited<ReturnType<typeof runDemoTopUp>> | undefined;
    await db
      .transaction(async (tx) => {
        result = await runDemoTopUp(tx);
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
