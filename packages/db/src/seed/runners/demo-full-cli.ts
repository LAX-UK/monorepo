/**
 * Runs the full demo seed against DATABASE_URL. Additive and idempotent, so it is safe on a shared
 * test database; it refuses production.
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:seed:demo-full [--dry-run]
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../schema/index.js";
import { buildPgConnectionConfig } from "../../ssl.js";
import { runDemoFull } from "../demo/demo-full-seed.js";

export function assertDemoFullTarget(env: {
  databaseUrl: string | undefined;
  nodeEnv?: string | undefined;
  appEnv?: string | undefined;
}): string {
  if (!env.databaseUrl) throw new Error("[demo-full] DATABASE_URL is required");
  const production = (value: string | undefined) =>
    ["production", "prod"].includes((value ?? "").toLowerCase());
  if (production(env.nodeEnv) || production(env.appEnv)) {
    throw new Error("[demo-full] refusing to run in production");
  }
  if (/prod/i.test(new URL(env.databaseUrl).hostname)) {
    throw new Error("[demo-full] refusing a production database host");
  }
  return env.databaseUrl;
}

async function main() {
  const url = assertDemoFullTarget({
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
    let result: Awaited<ReturnType<typeof runDemoFull>> | undefined;
    await db
      .transaction(async (tx) => {
        result = await runDemoFull(tx);
        if (dryRun) tx.rollback();
      })
      .catch((error: unknown) => {
        if (!(dryRun && error instanceof Error && error.message.includes("Rollback"))) throw error;
      });
    if (!result) throw new Error("[demo-full] nothing ran");
    if (dryRun) console.log("[demo-full] dry run: rolled back");
    console.log(`[demo-full] created people: ${result.topUp.created.join(", ") || "none"}`);
    console.log(`[demo-full] top-up catalogue: ${JSON.stringify(result.topUp.catalogue)}`);
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
